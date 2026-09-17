/**
 * Single-issue fix loop (FR-005 identity, FR-103 machinery): normalize →
 * reproduce → fix in a sandbox → verify in a FRESH sandbox → PR with verbatim
 * RED/GREEN evidence. The agent's own completion signal is never trusted; the
 * gate is `diffVerification` on output from a sandbox the agent never touched.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  assertClearedForAttachments,
  ConfidentialityGateError,
  discoverAttachmentUrls,
  fetchAndStageAttachment,
  type StagedAttachment,
} from "./attachments.js";
import { assertNoSecrets } from "./assert-no-secrets.js";
import { loadEnv, readEnvFile } from "./env.js";
import { normalizeGitHubIssue, type GitHubIssueInput, type NormalizedIssue } from "./issues.js";
import { resolveProvider } from "./providers.js";
import {
  TRIAGE_BRANCH,
  createFixSandbox,
  runFixRun,
  runTriage,
  type AgentSpec,
  type TriageRunInput,
} from "./sandcastle-adapter.js";
import { diffVerification, parsePytestFailures } from "./verify.js";
import {
  admitIssues,
  buildTriagePrompt,
  listOpenIssues,
  openPrListArgs,
  parseTriageOutput,
  realGhJson,
  splitQueue,
  type OpenPr,
  type QueueDeps,
  type TriageValue,
} from "./queue.js";

/** Commits made by the fix agent in target repos (workflow.md, FR-005). */
export const LOOP_IDENTITY = {
  name: "software-factory-loop",
  email: "manjula25+loop@users.noreply.github.com",
} as const;

/** Facts recorded by onboarding — validated by execution, committed to the target repo. */
export interface ProjectProfile {
  readonly language: string;
  readonly installCmd: string;
  /** Full-suite command whose output `parsePytestFailures` understands. */
  readonly testCmd: string;
  /** Single-test command; `{test}` is replaced with the reproduction test path. */
  readonly singleTestCmd: string;
  /** Failures a clean checkout already has — the repo is born red. */
  readonly baselineFailures: readonly string[];
  readonly expectedDurationSec: number;
  /**
   * Human assertion from onboarding (`--confidentiality-cleared`): Bitcot's
   * policy permits sending this repo's data to a third-party AI API. Absent
   * means not cleared — attachment URLs then trip the confidentiality gate.
   */
  readonly confidentialityCleared?: boolean;
}

/** Seam the loop runs on — the adapter plus PR creation, stubbed in tests. */
export interface LoopDeps {
  readonly env: Readonly<Record<string, string>>;
  runFixRun(input: {
    cwd: string;
    prompt: string;
    imageName: string;
    agent: AgentSpec;
    branch: string;
    name?: string;
    copyToWorktree?: readonly string[];
  }): Promise<{ stdout: string; commits: readonly { sha: string }[]; branch: string }>;
  createFixSandbox(input: {
    cwd: string;
    branch: string;
    /** Ref to fork from when `branch` does not exist yet (e.g. main, for preflight). */
    baseBranch?: string;
    imageName: string;
  }): Promise<{
    branch: string;
    worktreePath: string;
    exec(
      command: string,
      options?: { cwd?: string; stdin?: string },
    ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
    close(): Promise<unknown>;
  }>;
  /** Removes the loop's own leftover branches; resolves even if absent. */
  deleteBranch(repoDir: string, branch: string): Promise<void>;
  createPr(args: { repoDir: string; title: string; body: string; base: string; head: string }): Promise<{
    url: string;
  }>;
}

export interface SingleIssueInput {
  readonly issue: NormalizedIssue;
  /** Host clone of the target repo (the run anchors `.sandcastle/` under it). */
  readonly repoDir: string;
  readonly imageName: string;
  readonly agent: AgentSpec;
  readonly profile: ProjectProfile;
}

export interface LoopOutcome {
  readonly branch: string;
  readonly prUrl?: string;
  /** Set when the gate failed — a failed run is a valid diagnostic outcome. */
  readonly failure?: string;
  /**
   * Set when the failure is repo/harness-wide (stale baseline profile and the
   * like) rather than this issue's: a queue must abort, not grind through
   * every remaining issue hitting the same wall.
   */
  readonly failureKind?: "harness";
  readonly newFailures?: readonly string[];
  /**
   * Attachment URLs whose fetch failed (FR-004) — an input-quality note, never
   * a verification failure. Recorded loudly wherever the issue is reported.
   */
  readonly attachmentFailures?: readonly string[];
}

/** Deterministic home for the reproduction test (constraint 4: it stays in the suite). */
export function reproTestPath(issue: NormalizedIssue): string {
  return `tests/fixed-issues/test_${issue.id.replace(/-/g, "_")}.py`;
}

export function fixBranch(issue: NormalizedIssue): string {
  return `fix/${issue.id}`;
}

/** Throwaway branch the baseline preflight check runs on (deleted after). */
function preflightBranch(issue: NormalizedIssue): string {
  return `loop/preflight-${issue.id}`;
}

/** A pytest summary line ("N passed/failed/error…") — proof the output is readable. */
const SUITE_SUMMARY_RE = /\b\d+ (?:passed|failed|error)/;

/**
 * Parse full-suite output, or reject it as unreadable. "No failure lines" from
 * a command that never ran (exit 127, empty output) must not read as "no new
 * failures" — silence is not success for the gate.
 */
function parseSuiteOrReject(stdout: string): { ok: true; failures: string[] } | { ok: false; reason: string } {
  if (!SUITE_SUMMARY_RE.test(stdout)) {
    const head = stdout.trim().slice(0, 120).replace(/\n/g, "\\n");
    return { ok: false, reason: `full-suite output is unreadable — no pytest summary line found (starts: "${head}")` };
  }
  return { ok: true, failures: parsePytestFailures(stdout) };
}

function extractEvidence(stdout: string, tag: "red" | "green"): string {
  const open = `<${tag}-evidence>`;
  const close = `</${tag}-evidence>`;
  const start = stdout.indexOf(open);
  const end = stdout.indexOf(close);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Fix run stdout lacks a ${open}…${close} block — cannot build PR evidence.`);
  }
  return stdout.slice(start + open.length, end).trim();
}

/** Attachment material for the fix prompt (FR-003/FR-004): excerpts + misses. */
export interface PromptAttachments {
  readonly staged: readonly StagedAttachment[];
  readonly failedUrls: readonly string[];
}

function buildAttachmentSection(attachments: PromptAttachments): string {
  if (attachments.staged.length === 0 && attachments.failedUrls.length === 0) {
    return "";
  }
  return `\n## Attachments from the issue report\n\n${[
    ...attachments.staged.map(
      (a) =>
        `Full file fetched into the repo at \`${a.stagedPath}\` (read the rest there):\n\n\`\`\`\n${a.excerpt}\n\`\`\``,
    ),
    ...attachments.failedUrls.map(
      (url) => `- attachment expected but unavailable: ${url} (attachment fetch failed)`,
    ),
  ].join("\n\n")}\n`;
}

export function buildFixPrompt(
  issue: NormalizedIssue,
  profile: ProjectProfile,
  attachments?: PromptAttachments,
): string {
  return `You are fixing one reported issue in this repository.

## The issue (${issue.id})

${issue.description}
${issue.attachedLog ? `\n## Attached log from the report\n\n\`\`\`\n${issue.attachedLog}\n\`\`\`\n` : ""}${attachments ? buildAttachmentSection(attachments) : ""}
## How to work in this repo (recorded at onboarding — use these exact commands)

- install: ${profile.installCmd}
- full suite: ${profile.testCmd}
- one test: ${profile.singleTestCmd}

## Required procedure

1. Write a reproduction test at exactly \`${reproTestPath(issue)}\` that fails for the reason
   the issue describes. Run it and keep the verbatim failing output.
2. Fix the reported defect (and nothing else — do not refactor unrelated code, do not touch
   other open issues' symptoms).
3. Re-run your reproduction test and the full suite. The suite has known pre-existing failures;
   your fix must clear yours without adding any new failure.
4. Commit only the fix and the reproduction test — never anything under \`.loop-harness/\` —
   with the machine identity:

   git config user.name ${LOOP_IDENTITY.name}
   git config user.email ${LOOP_IDENTITY.email}

## Required output format

End your output with two fenced blocks, verbatim tool output inside, nothing paraphrased:

<red-evidence>
(the failing run of your reproduction test, before the fix)
</red-evidence>
<green-evidence>
(the passing run of your reproduction test, after the fix)
</green-evidence>`;
}

export function buildPrBody(
  issue: NormalizedIssue,
  redEvidence: string,
  greenEvidence: string,
  verification: { passed: boolean; newFailures: readonly string[] },
  attachmentFailures?: readonly string[],
): string {
  const symptomLine = `Symptom mapping: issue ${issue.id} reported "${issue.description.split("\n")[0].replace(/^#\s*/, "")}" — reproduced by \`${reproTestPath(issue)}\` failing exactly that way, now passing.`;
  const attachmentNote = (attachmentFailures ?? []).length > 0
    ? `\n${attachmentFailures!.map((url) => `attachment fetch failed: ${url}`).join("\n")}\n`
    : "";
  return `Automated fix for issue ${issue.id}${issue.url ? ` (${issue.url})` : ""}.

The reproduction test is retained in the suite at \`${reproTestPath(issue)}\`.

## RED — reproduction test before the fix (verbatim)

\`\`\`
${redEvidence}
\`\`\`

## GREEN — reproduction test after the fix (verbatim)

\`\`\`
${greenEvidence}
\`\`\`
${attachmentNote}
${symptomLine}

Independent verification in a fresh sandbox: reproduction test passed; full-suite diff versus
the onboarding baseline shows no new failures${verification.newFailures.length > 0 ? ` (except: ${verification.newFailures.join(", ")})` : ""}.

A human reviews and merges this — please judge whether the reproduced symptom matches the report.`;
}

export async function runSingleIssue(input: SingleIssueInput, deps: LoopDeps): Promise<LoopOutcome> {
  const branch = fixBranch(input.issue);

  // FR-002: the gate refuses BEFORE the preflight sandbox — an uncleared repo
  // never spends a container or an API call on an attachment-carrying issue.
  // The refusal is issue-level (no failureKind): the queue continues, because
  // attachment-free issues in the same repo are governed by the WI-1/WI-2 seam.
  const attachmentUrls = discoverAttachmentUrls(input.issue.description);
  try {
    assertClearedForAttachments(input.profile, attachmentUrls, input.repoDir);
  } catch (error) {
    if (!(error instanceof ConfidentialityGateError)) {
      throw error;
    }
    return { branch, failure: error.message };
  }
  // FR-003/FR-004: fetch what the report uploaded. A failed URL never blocks
  // the others and never blocks the issue — it is recorded loudly instead.
  const staged: StagedAttachment[] = [];
  const attachmentFailures: string[] = [];
  for (const url of attachmentUrls) {
    const result = await fetchAndStageAttachment({
      url,
      repoDir: input.repoDir,
      issueId: input.issue.id,
    });
    if ("failed" in result) {
      attachmentFailures.push(result.failed);
    } else {
      staged.push(result);
    }
  }

  const prompt = buildFixPrompt(input.issue, input.profile, { staged, failedUrls: attachmentFailures });

  // FR-003: everything we emit is checked before it leaves the harness. The
  // excerpt sits inside the prompt, so it is guarded with no new wiring.
  assertNoSecrets([prompt], deps.env);

  // Baseline preflight (FR-104 staleness rule): the recorded baseline must
  // still match a fresh run of the unfixed tree, or every later diff is
  // meaningless. Runs before the fix agent — no API spend on a stale profile.
  const preBranch = preflightBranch(input.issue);
  const pre = await deps.createFixSandbox({
    cwd: input.repoDir,
    branch: preBranch,
    baseBranch: "main",
    imageName: input.imageName,
  });
  let baselineProblem: string | undefined;
  try {
    const install = await pre.exec(input.profile.installCmd);
    if (install.exitCode !== 0) {
      baselineProblem = `install command exited ${install.exitCode} during the baseline check`;
    } else {
      const suite = await pre.exec(input.profile.testCmd);
      const parsed = parseSuiteOrReject(suite.stdout);
      if (!parsed.ok) {
        baselineProblem = parsed.reason;
      } else {
        const actual = new Set(parsed.failures);
        const missing = input.profile.baselineFailures.filter((f) => !actual.has(f));
        const extra = parsed.failures.filter((f) => !input.profile.baselineFailures.includes(f));
        if (missing.length > 0 || extra.length > 0) {
          baselineProblem =
            `project profile is stale — baseline no longer matches a fresh run ` +
            `(recorded but not failing: ${missing.join(", ") || "none"}; ` +
            `failing but not recorded: ${extra.join(", ") || "none"}). Re-run onboarding.`;
        }
      }
    }
  } finally {
    await pre.close();
    await deps.deleteBranch(input.repoDir, preBranch);
  }
  if (baselineProblem) {
    return {
      branch,
      failure: `Aborted before the fix run — ${baselineProblem}.`,
      failureKind: "harness",
    };
  }

  const fix = await deps.runFixRun({
    cwd: input.repoDir,
    prompt,
    imageName: input.imageName,
    agent: input.agent,
    branch,
    name: input.issue.id,
    // Copy the single top-level `.loop-harness` directory, never per-file
    // stagedPaths: Sandcastle's copyToWorktree runs `cp -R` without creating
    // dest parent directories, so a nested path like
    // `.loop-harness/attachments/gh-1/aaaa` fails in a fresh worktree. The
    // directory copy also carries the staging `.gitignore` (and the
    // machine-local profile) into the worktree; the prompt's
    // never-commit-anything-under-`.loop-harness/` rule is the paired defense.
    ...(staged.length > 0 ? { copyToWorktree: [".loop-harness"] } : {}),
  });

  // A failed run must not leave its fix branch behind — the next run would
  // trip over it (attempt-5/6 lesson).
  const fail = async (reason: string, newFailures?: readonly string[]): Promise<LoopOutcome> => {
    await deps.deleteBranch(input.repoDir, branch);
    return {
      branch,
      failure: reason,
      ...(newFailures ? { newFailures } : {}),
      ...(attachmentFailures.length > 0 ? { attachmentFailures: [...attachmentFailures] } : {}),
    };
  };

  if (fix.commits.length === 0) {
    return fail("Fix run produced no commits — nothing to verify or PR.");
  }

  // Fresh-sandbox verification: the agent's own "done" is never evidence.
  const redEvidence = extractEvidence(fix.stdout, "red");
  const greenEvidence = extractEvidence(fix.stdout, "green");
  assertNoSecrets([redEvidence, greenEvidence], deps.env);

  const sandbox = await deps.createFixSandbox({
    cwd: input.repoDir,
    branch,
    imageName: input.imageName,
  });
  try {
    // Each sandbox is a fresh container: the agent's `pip install -e .` (or
    // equivalent) lived in ITS site-packages, not this one's. Without the
    // install, every test file errors at collection and reads as new failures.
    const install = await sandbox.exec(input.profile.installCmd);
    if (install.exitCode !== 0) {
      return fail(`Verification failed — install command exited ${install.exitCode} in the fresh sandbox.`);
    }
    const reproCmd = input.profile.singleTestCmd.replace("{test}", reproTestPath(input.issue));
    const repro = await sandbox.exec(reproCmd);
    const suite = await sandbox.exec(input.profile.testCmd);
    const parsed = parseSuiteOrReject(suite.stdout);
    if (!parsed.ok) {
      return fail(`Verification failed — ${parsed.reason}.`);
    }
    const verification = diffVerification({
      baselineFailures: input.profile.baselineFailures,
      postFixFailures: parsed.failures,
      reproTestPassed: repro.exitCode === 0,
    });
    if (!verification.passed) {
      const reason = verification.newFailures.length > 0
        ? `new failures vs baseline: ${verification.newFailures.join(", ")}`
        : "reproduction test did not pass in the fresh sandbox";
      return fail(`Verification failed — ${reason}.`, verification.newFailures);
    }

    const title = `[loop] fix ${input.issue.id}: ${input.issue.description.split("\n")[0].replace(/^#\s*/, "")}`;
    const body = buildPrBody(input.issue, redEvidence, greenEvidence, verification, attachmentFailures);
    assertNoSecrets([title, body], deps.env);

    const pr = await deps.createPr({ repoDir: input.repoDir, title, body, base: "main", head: branch });
    return {
      branch,
      prUrl: pr.url,
      ...(attachmentFailures.length > 0 ? { attachmentFailures: [...attachmentFailures] } : {}),
    };
  } finally {
    await sandbox.close();
  }
}

// ---------------------------------------------------------------------------
// WI-2: queue mode — sequential runner over the admitted queue (FR-004/FR-005).
// ---------------------------------------------------------------------------

/** Everything the queue runner needs beyond the single-issue loop. */
export type QueueLoopDeps = LoopDeps & QueueDeps & {
  runTriage(input: TriageRunInput): Promise<string>;
};

export interface QueueRunInput {
  readonly ghRepo: string;
  readonly repoDir: string;
  readonly imageName: string;
  readonly agent: AgentSpec;
  readonly profile: ProjectProfile;
  readonly label?: string;
  readonly cap: number;
  readonly triage: boolean;
}

export interface QueueSummary {
  readonly attempted: string[];
  readonly fixed: string[];
  readonly failed: [string, string][];
  readonly skippedDuplicate: string[];
  /** [id, reason] — the cap, or "file overlap with gh-N" (decision 14). */
  readonly notAdmitted: [string, string][];
  /** [id, url] — attachment fetches that failed (FR-004); notes, never gates. */
  readonly attachmentFailures: [string, string][];
  readonly prUrls: string[];
}

/**
 * A harness-level abort, carrying the summary of everything the run had
 * already earned. A queue that opened a PR for gh-1 and then hit a stale
 * baseline on gh-2 must still tell the operator about that PR — it is real,
 * human-reviewable work, and losing it would make the run dishonest.
 */
export class QueueAbortedError extends Error {
  readonly summary: QueueSummary;
  constructor(message: string, summary: QueueSummary) {
    super(message);
    this.name = "QueueAbortedError";
    this.summary = summary;
  }
}

/**
 * Run the queue: acquire → dedup → (opt-in triage) → admit ≤ cap → run each
 * admitted issue sequentially through runSingleIssue. An issue-level failure
 * is recorded and the queue continues; a harness-level failure (stale
 * baseline, credentials) aborts with a `QueueAbortedError` whose `summary`
 * holds the partial run — the caller prints both that and the abort reason.
 */
export async function runQueue(input: QueueRunInput, deps: QueueLoopDeps): Promise<QueueSummary> {
  const issues = await listOpenIssues(deps, {
    repo: input.ghRepo,
    ...(input.label !== undefined ? { label: input.label } : {}),
  });
  const split = await splitQueue(deps, input.repoDir, issues);

  // The flag is the opt-in, so triage runs at any queue size — its file-overlap
  // deferral (decision 14) is what keeps two same-module fixes from becoming
  // conflicting PRs, and that matters below the cap too. One issue can overlap
  // nothing and outrank nobody, so it never buys a model call.
  let triage: TriageValue | undefined;
  let triageUnusable = false;
  let triageError: string | undefined;
  if (input.triage && split.eligible.length > 1) {
    const prompt = buildTriagePrompt(split.eligible);
    assertNoSecrets([prompt], deps.env);
    try {
      const stdout = await deps.runTriage({
        cwd: input.repoDir,
        prompt,
        imageName: input.imageName,
        agent: input.agent,
      });
      triage = parseTriageOutput(stdout, split.eligible.map((i) => i.id));
    } catch (error) {
      // The scoring pass is an optimization, never a gate: a failed triage run
      // degrades the ordering, it does not cost the queue its issues.
      triageError = error instanceof Error ? error.message : String(error);
    } finally {
      // Runs on the throw path too, so a failed pass never leaks the branch.
      await deps.deleteBranch(input.repoDir, TRIAGE_BRANCH);
    }
    triageUnusable = triage === undefined;
  }

  const admission = admitIssues({
    issues: split.eligible,
    cap: input.cap,
    ...(triage !== undefined ? { triage } : {}),
    ...(triageUnusable ? { triageUnusable: true } : {}),
  });
  if (admission.degraded) {
    // The reason can quote a subprocess error, so it passes the guard like any
    // other emitted string before it reaches a terminal or an evidence log.
    const warning = `[queue] WARNING: triage unusable (${triageError ?? "output failed validation"}) — falling back to deterministic order (ascending issue number).`;
    assertNoSecrets([warning], deps.env);
    console.error(warning);
  }

  const attempted: string[] = [];
  const fixed: string[] = [];
  const failed: [string, string][] = [];
  const attachmentFailures: [string, string][] = [];
  const prUrls: string[] = [];
  const snapshot = (): QueueSummary => ({
    attempted: [...attempted],
    fixed: [...fixed],
    failed: [...failed],
    skippedDuplicate: split.skippedDuplicate,
    notAdmitted: admission.notAdmitted.map((n) => [n.issue.id, n.reason] as [string, string]),
    attachmentFailures: [...attachmentFailures],
    prUrls: [...prUrls],
  });

  for (const issue of admission.admitted) {
    const outcome = await runSingleIssue(
      {
        issue,
        repoDir: input.repoDir,
        imageName: input.imageName,
        agent: input.agent,
        profile: input.profile,
      },
      deps,
    );
    attempted.push(issue.id);
    for (const url of outcome.attachmentFailures ?? []) {
      attachmentFailures.push([issue.id, url]);
    }
    if (outcome.prUrl) {
      fixed.push(issue.id);
      prUrls.push(outcome.prUrl);
      continue;
    }
    // A repo-wide preflight abort (stale baseline) will fail every remaining
    // issue identically — that is a harness-level failure, not this issue's.
    failed.push([issue.id, outcome.failure ?? "unknown failure"]);
    if (outcome.failureKind === "harness") {
      throw new QueueAbortedError(`Queue aborted — ${issue.id}: ${outcome.failure}`, snapshot());
    }
  }

  return snapshot();
}

export function formatSummary(summary: QueueSummary): string {
  return [
    `Run summary — attempted: ${summary.attempted.length} (fixed: ${summary.fixed.length}, failed: ${summary.failed.length}) | skipped-duplicate: ${summary.skippedDuplicate.length} | not-admitted: ${summary.notAdmitted.length}`,
    ...summary.prUrls.map((url) => `PR: ${url}`),
    ...summary.failed.map(([id, reason]) => `FAILED ${id}: ${reason}`),
    ...summary.attachmentFailures.map(([id, url]) => `ATTACHMENT FAILED ${id}: ${url}`),
    ...summary.notAdmitted.map(([id, reason]) => `NOT ADMITTED ${id}: ${reason}`),
  ].join("\n");
}

/** `--max-issues` is validated at startup, before any acquisition or spend. */
export function parseCap(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`--max-issues must be an integer >= 1 (got "${raw}")`);
  }
  return n;
}

export type OverrideOutcome =
  | { readonly kind: "skipped-duplicate"; readonly id: string }
  | { readonly kind: "run"; readonly outcome: LoopOutcome };

/**
 * `--issue N` single-issue override: no cap, no triage — the user named the
 * issue — but dedup still applies (decision 6). Also cleans a stale fix
 * branch for the named issue so the retry starts from clean main.
 */
export async function runOverrideIssue(
  input: SingleIssueInput,
  deps: LoopDeps & QueueDeps,
): Promise<OverrideOutcome> {
  const split = await splitQueue(deps, input.repoDir, [input.issue]);
  if (split.skippedDuplicate.includes(input.issue.id)) {
    return { kind: "skipped-duplicate", id: input.issue.id };
  }
  return { kind: "run", outcome: await runSingleIssue(input, deps) };
}

// ---------------------------------------------------------------------------
// CLI entry (WI-2: queue mode is the default; --issue N is the override):
// npm run loop -- --repo <dir-or-owner/name> [--issue <n>] [--label <label>]
//                [--max-issues <n>] [--triage] --provider <name>
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string): string => {
    const i = args.indexOf(`--${name}`);
    if (i === -1 || i + 1 >= args.length) {
      throw new Error(`missing --${name}`);
    }
    return args[i + 1]!;
  };
  const optFlag = (name: string): string | undefined =>
    args.includes(`--${name}`) ? flag(name) : undefined;

  const repoArg = flag("repo");
  const issueArg = optFlag("issue");
  const providerName = flag("provider");
  const imageName = optFlag("image") ?? "sandcastle-loop";
  const modelOverride = optFlag("model");
  const cap = parseCap(optFlag("max-issues") ?? "3");
  const label = optFlag("label");
  const triage = args.includes("--triage");

  const env = loadEnv(process.cwd());
  const agent = resolveProvider(providerName, env, modelOverride);
  // Guard scope = the values configured in .env, not the whole process env:
  // npm run exports npm_package_name etc., which collides with our own
  // "software-factory-loop" identity in prompts — machinery, not secrets.
  const guardEnv = readEnvFile(process.cwd());

  // Resolve the target repo: a local clone directory (contains .git), or
  // owner/name which we clone under ./.loop-work/ first.
  let repoDir: string;
  let ghRepo: string;
  if (existsSync(join(repoArg, ".git"))) {
    repoDir = resolve(repoArg);
    ghRepo = execFileSync(
      "gh",
      ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
      { cwd: repoDir, encoding: "utf8" },
    ).trim();
  } else {
    ghRepo = repoArg;
    const workRoot = join(process.cwd(), ".loop-work");
    repoDir = join(workRoot, repoArg.split("/").pop()!);
    if (!existsSync(join(repoDir, ".git"))) {
      mkdirSync(workRoot, { recursive: true });
      execFileSync("gh", ["repo", "clone", repoArg, repoDir], { stdio: "inherit" });
    }
  }

  // The profile — onboarding (T9) must have recorded it already.
  const profilePath = join(repoDir, ".loop-harness", "profile.json");
  if (!existsSync(profilePath)) {
    throw new Error(`no project profile at ${profilePath} — run the onboarding pass first (T9)`);
  }
  const profile = JSON.parse(readFileSync(profilePath, "utf8")) as ProjectProfile;

  const deps: LoopDeps = {
    env: guardEnv,
    runFixRun,
    createFixSandbox,
    async deleteBranch(repoDir, branchToDelete) {
      try {
        execFileSync("git", ["branch", "-D", branchToDelete], { cwd: repoDir, stdio: "pipe" });
      } catch {
        // already absent — nothing to clean up
      }
    },
    // The PR opens on the TARGET repo, under the owner's own gh auth; the fix
    // branch is pushed first because gh pr create needs it on the remote.
    async createPr({ repoDir: dir, title, body, base, head }) {
      execFileSync("git", ["push", "-u", "origin", head], { cwd: dir, stdio: "inherit" });
      const url = execFileSync(
        "gh",
        ["pr", "create", "--title", title, "--body", body, "--base", base, "--head", head],
        { cwd: dir, encoding: "utf8" },
      ).trim();
      return { url };
    },
  };

  // Real QueueDeps wiring: gh + git subprocesses against the target clone.
  const queueDeps: QueueDeps & { runTriage(input: TriageRunInput): Promise<string> } = {
    ghJson: realGhJson,
    async listOpenPrs(dir) {
      return JSON.parse(realGhJson(openPrListArgs(), dir)) as OpenPr[];
    },
    async listFixBranches(dir) {
      return [...new Set([...localFixBranches(dir), ...remoteFixBranches(dir)])];
    },
    async deleteRemoteBranch(dir, branch) {
      try {
        execFileSync("git", ["push", "origin", "--delete", branch], { cwd: dir, stdio: "pipe" });
      } catch {
        // already absent on the remote — nothing to clean up
      }
    },
    runTriage,
  };
  const allDeps = { ...deps, ...queueDeps };

  if (issueArg !== undefined) {
    // Single-issue override (decision 6): no cap, no triage, dedup applies.
    const raw = JSON.parse(
      execFileSync(
        "gh",
        ["issue", "view", issueArg, "--repo", ghRepo, "--json", "number,title,body,url"],
        { encoding: "utf8" },
      ),
    ) as GitHubIssueInput;
    const issue = normalizeGitHubIssue(raw);
    const result = await runOverrideIssue(
      { issue, repoDir, imageName, agent, profile },
      allDeps,
    );
    if (result.kind === "skipped-duplicate") {
      console.log(`[${result.id}] skipped — an open PR already covers it`);
      return;
    }
    if (result.outcome.prUrl) {
      console.log(`PR opened: ${result.outcome.prUrl}`);
    } else {
      console.error(`Loop finished without a PR — ${result.outcome.failure}`);
      process.exitCode = 1;
    }
    return;
  }

  // Queue mode (the WI-2 default). A harness-level abort still prints the
  // summary of what the run already earned — PRs opened before the abort are
  // real work the operator has to know about — then the reason, then exits 1.
  const emit = (summary: QueueSummary, abort?: string): void => {
    const text = formatSummary(summary);
    assertNoSecrets(abort !== undefined ? [text, abort] : [text], guardEnv);
    console.log(text);
    if (abort !== undefined) {
      console.error(abort);
      process.exitCode = 1;
    }
  };
  try {
    emit(
      await runQueue(
        { ghRepo, repoDir, imageName, agent, profile, ...(label !== undefined ? { label } : {}), cap, triage },
        allDeps,
      ),
    );
  } catch (error) {
    if (!(error instanceof QueueAbortedError)) {
      throw error;
    }
    emit(error.summary, error.message);
  }
}

/** Local `fix/*` branches in the target clone. */
function localFixBranches(repoDir: string): string[] {
  return execFileSync("git", ["branch", "--list", "fix/*"], {
    cwd: repoDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\n")
    .map((line) => line.trim().replace(/^\* ?/, ""))
    .filter(Boolean);
}

/** Remote `fix/*` branches on origin, as short names. */
function remoteFixBranches(repoDir: string): string[] {
  return execFileSync("git", ["ls-remote", "--heads", "origin", "refs/heads/fix/*"], {
    cwd: repoDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\n")
    .map((line) => line.trim().split("refs/heads/")[1] ?? "")
    .filter(Boolean);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]).endsWith("src/loop.ts");
if (isDirectRun) {
  try {
    await main();
  } catch (error) {
    // A plain throw here surfaces as an unhandled rejection — a stack trace
    // where the operator needs a reason and a usable exit code.
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  }
}
