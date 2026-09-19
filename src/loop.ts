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
import {
  normalizeGitHubIssue,
  parsePlainList,
  parseSpecDoc,
  type GitHubIssueInput,
  type NormalizedIssue,
} from "./issues.js";
import { resolveProvider } from "./providers.js";
import {
  PLAN_BRANCH,
  REVIEW_BRANCH,
  createFixSandbox,
  runFixRun,
  runPlan,
  runReview,
  type AgentSpec,
  type PlanRunInput,
} from "./sandcastle-adapter.js";
import { diffVerification, parsePytestFailures, SUITE_SUMMARY_RE } from "./verify.js";
import {
  buildPlanPrompt,
  listOpenIssues,
  orderFromPlan,
  prListArgs,
  parsePlanOutput,
  parseReviewOutput,
  realGhJson,
  splitQueue,
  type MergedPr,
  type OpenPr,
  type PlanValue,
  type QueueDeps,
  type ReviewVerdict,
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
  /**
   * Opt-in to automatic squash-merge of verified PRs (WI-6). Recorded only by
   * `--auto-merge` at onboarding; absent = off (the default — a human merges
   * every PR). Hand-editable only by a human, outside the harness. The
   * harness's own repo never sets it (constraint 1, amended 2026-09-18).
   */
  readonly autoMerge?: boolean;
  /**
   * WI-6 (D6/R1, FR-007): the handle @-mentioned in a canary-red revert
   * comment. HAND-EDIT ONLY — this field's only write path is a human
   * editing profile.json (no onboarding flag, no writer code; a
   * once-per-repo value does not earn a CLI surface). Absent → the revert
   * comment still posts, without a mention, and the summary says the notify
   * handle is not configured.
   */
  readonly notifyHandle?: string;
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
  /**
   * Whether `path` is committed on `branch` of the target repo — the nesting
   * guard's evidence (`git ls-tree --name-only <branch> -- <path>`).
   */
  pathCommittedOnBranch(repoDir: string, branch: string, path: string): Promise<boolean>;
  createPr(args: { repoDir: string; title: string; body: string; base: string; head: string }): Promise<{
    url: string;
  }>;
  /**
   * WI-6 (T6, FR-009, D7): `git diff main...<branch>` — the change the
   * pre-merge review pass judges.
   */
  fixDiff(repoDir: string, branch: string): Promise<string>;
  /**
   * WI-6 (T6, FR-009, D7): one bounded cheap-model review run on the throwaway
   * `loop/review` branch. The caller builds the prompt (`buildReviewPrompt`),
   * secrets-guards it before the call, and deletes the branch afterwards. A
   * thrown run maps to the `uncertain` verdict class at the call site.
   */
  runReview(input: PlanRunInput & { readonly diff: string }): Promise<string>;
  /**
   * WI-6 (D1): squash-merge an existing PR and report the merge commit. Real
   * wiring shells `gh pr merge --squash --delete-branch` then reads the merge
   * commit back — any non-zero exit throws, and the loop catches (FR-004's
   * safe fallback: PR stays open, run continues).
   */
  mergePr(input: { repoDir: string; prUrl: string }): Promise<{ mergeCommit: string }>;
  /**
   * WI-6 (D3, FR-005): fast-forward the target clone's main to origin's
   * (`git fetch origin main:main`). Loud on divergence — a refused
   * fast-forward exits non-zero and throws; the canary never judges a
   * stale main silently.
   */
  syncMain(repoDir: string): Promise<void>;
  /**
   * WI-6 (D4, FR-006): revert `mergeCommit` on main and push the revert
   * (`git revert --no-edit` + `git push origin main`), reporting the revert
   * commit. Best-effort at the call site: a thrown failure is recorded in
   * the outcome — the halt happens regardless.
   */
  revertMerge(input: { repoDir: string; mergeCommit: string }): Promise<{ revertCommit: string }>;
  /**
   * WI-6 (FR-007): post a comment on a PR (`gh pr comment`) — the @-mention
   * notification path. Best-effort at the call site: failure is recorded,
   * never thrown past the revert chain.
   */
  commentOnPr(input: { repoDir: string; prUrl: string; body: string }): Promise<void>;
  /**
   * WI-6 (FR-008, T5): close a gh-sourced issue with an evidence comment
   * (`gh issue close <n> --comment <body>`, the number parsed from the issue
   * url). Called only at the end of the green auto-merge chain (D3 ordering:
   * merge → canary → close). Best-effort at the call site: closing is
   * bookkeeping — a throw is recorded, the merged outcome stands, and the
   * run continues.
   */
  closeIssue(repoDir: string, issue: NormalizedIssue, comment: string): Promise<void>;
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
  /**
   * WI-6 (FR-004/FR-005): set when the auto-merge (opted-in profiles only)
   * succeeded AND the post-merge canary suite on merged main went green —
   * the PR is squash-merged on the base branch at this commit.
   */
  readonly merged?: {
    readonly prUrl: string;
    readonly mergeCommit: string;
    /** WI-6 T4: always true when `merged` is set — a red canary reverts instead. */
    readonly canaryGreen: boolean;
  };
  /**
   * WI-6 (FR-004): set when the auto-merge was attempted and FAILED (conflict,
   * moved base, API error). The PR stays open for a human and the run continues
   * — this is a loud note, never a failure of the issue itself (the fix is
   * verified and the PR is real work).
   */
  readonly mergeFailure?: string;
  /**
   * WI-6 (FR-008): set when closing a gh-sourced issue after a canary-green
   * merge FAILED. The merge stands — the fix is merged and canary-green, and
   * closing is bookkeeping — so like `mergeFailure` this is a loud note on a
   * merged outcome, never an issue failure; the queue continues.
   */
  readonly closeFailure?: string;
  /**
   * WI-7 (FR-003) / WI-8 (FR-001): set when a sandbox's TEARDOWN failed after
   * the suite had already decided the verdict — the canary (close() threw, or
   * the canary branch delete refused), the baseline preflight, or the fresh
   * verification sandbox. Pure bookkeeping beside that verdict, never over it:
   * a green canary stays merged (the failure rides the MERGED summary line), a
   * red one still reverts (the failure is named in the RevertedRecord), and a
   * preflight/verification teardown failure rides the stale abort, the fail()
   * outcome, or the PR'd outcome (and its FAILED/MERGED summary line) without
   * changing any of them. WI-11 (FR-001, decision d1): on a MERGED run this
   * field is the EARLY origin only (preflight/verification) — the canary's own
   * teardown failure rides `canaryTeardownFailure` beside it; the two are
   * distinct origin-labeled facts, never one joined string, and neither
   * displaces the other.
   */
  readonly teardownFailure?: string;
  /**
   * WI-11 (FR-001, decision d1): set when the CANARY sandbox's teardown failed
   * on a run that ended in a merge — the canary-origin sibling of
   * `teardownFailure` (which stays the early origin there). Rendered beside it
   * on every merged surface (queue MERGED line, single-issue report) with its
   * own `canary teardown` label when both origins failed; on a canary-red run
   * the canary reason keeps its WI-7 home in `reverted.teardownFailure`.
   */
  readonly canaryTeardownFailure?: string;
  /**
   * WI-6 (FR-009): set when the pre-merge review pass did NOT approve — no
   * merge happened, the PR stays open for a human, and the skip reason was
   * commented on the PR. Like `mergeFailure` this is a loud note on a PR'd
   * outcome, never an issue failure: the fix is verified, the queue continues,
   * and the summary carries its own `REVIEW SKIP` surface.
   */
  readonly reviewSkip?: string;
  /**
   * WI-6 (FR-006/FR-007): set on the canary-red path — the merge was reverted
   * (or the revert itself failed loudly), the queue must halt
   * (`failureKind: "harness"`), and the summary prints its `⚠️ REVERTED`
   * section from this record. No `prUrl`/`merged` on this outcome: a reverted
   * issue is NOT fixed, and the merged-dedup's revert guard re-queues it.
   */
  readonly reverted?: RevertedRecord;
  /**
   * WI-7 (FR-002): set when a merge LANDED but the canary never ran — the
   * post-merge main sync failed, so merged main was never verified. Mirrors
   * `reverted`'s posture: deliberately NO `prUrl` on the outcome itself and a
   * `failureKind: "harness"` failure — the issue is merged-but-unverified, not
   * fixed — and the queue halts (a stale/divergent clone will fail every later
   * issue the same way).
   */
  readonly uncanaried?: UncanariedRecord;
}

/**
 * What the summary needs to report an uncanaried merge (WI-7 FR-002):
 * identifiers plus why the canary never ran and whether the warning comment
 * reached the PR. Harness-known values only.
 */
export interface UncanariedRecord {
  readonly id: string;
  readonly prUrl: string;
  readonly mergeCommit: string;
  /** Why syncing the local clone to the merged base failed. */
  readonly syncFailure: string;
  /** `posted`, or `FAILED (<reason>)` when the best-effort comment threw. */
  readonly commentNote: string;
  /** The profile's notifyHandle at uncanaried time; absent = not configured (D6). */
  readonly notifyHandle?: string;
}

/**
 * WI-7 (FR-002): the shared body of the ⚠️ UNCANARIED MERGE line — built once
 * so the outcome's failure string and `formatSummary` agree byte-for-byte.
 */
function uncanariedDetail(record: UncanariedRecord): string {
  return (
    `pr ${record.prUrl} merge ${record.mergeCommit} — main sync failed: ${record.syncFailure}; comment: ${record.commentNote}` +
    // WI-8 (FR-003): the detail's notify posture is unconditional — the same
    // vocabulary as the reverted summary line.
    (record.notifyHandle !== undefined ? `; notify: @${record.notifyHandle}` : "; notify handle not configured")
  );
}

/**
 * What the summary needs to report a canary-red revert (FR-006/FR-007):
 * identifiers, evidence, and the notify outcome. All fields are harness-known
 * values or test-node ids — never raw suite output beyond the evidence string
 * built by the canary step.
 */
export interface RevertedRecord {
  readonly id: string;
  readonly prUrl: string;
  readonly mergeCommit: string;
  /** Present iff the revert landed on main; absent = revert failed. */
  readonly revertCommit?: string;
  /** Why the revert failed, when it did — the summary must not hide it. */
  readonly revertFailure?: string;
  /** Why the canary went red (the FR-005 evidence). */
  readonly evidence: string;
  /**
   * WI-7 (FR-003): the canary's teardown (close / branch delete) failed on an
   * already-red canary. Named here and on the summary line, never folded into
   * `evidence` — the verdict and its evidence stand as decided.
   */
  readonly teardownFailure?: string;
  /** The profile's notifyHandle at revert time; absent = not configured (D6). */
  readonly notifyHandle?: string;
}

/** Deterministic home for the reproduction test (constraint 4: it stays in the suite). */
export function reproTestPath(issue: NormalizedIssue): string {
  return `tests/fixed-issues/test_${issue.id.replace(/-/g, "_")}.py`;
}

export function fixBranch(issue: NormalizedIssue): string {
  return `fix/${issue.id}`;
}

/**
 * WI-6 (D3, FR-005): fast-forward local main to origin's before the canary,
 * loud on divergence. The plan's literal `git fetch origin main:main` is
 * unrunnable in the loop's real configuration — git refuses to update a ref
 * that is checked out, and loop target clones sit on main (T7 live finding,
 * 2026-09-18) — so the wiring is branch-aware: `pull --ff-only` when main is
 * the current branch, the fetch-ref form otherwise. Both refuse a divergent
 * main non-zero, which throws before any canary spend.
 */
export function syncMainToOrigin(repoDir: string): void {
  // Prune first (T7 live finding #2): `gh pr merge --delete-branch` removes
  // the remote fix branch but leaves the stale remote-tracking ref behind in
  // the target clone — the next run on the same issue would fork its fix
  // branch from that stale ref and find the fix already committed.
  execFileSync("git", ["fetch", "--prune", "origin"], { cwd: repoDir, stdio: "inherit" });
  const current = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (current === "main") {
    execFileSync("git", ["pull", "--ff-only", "origin", "main"], { cwd: repoDir, stdio: "inherit" });
  } else {
    execFileSync("git", ["fetch", "origin", "main:main"], { cwd: repoDir, stdio: "inherit" });
  }
}

/** Throwaway branch the baseline preflight check runs on (deleted after). */
function preflightBranch(issue: NormalizedIssue): string {
  return `loop/preflight-${issue.id}`;
}

/**
 * Parse full-suite output, or reject it as unreadable. "No failure lines" from
 * a command that never ran (exit 127, empty output) must not read as "no new
 * failures" — silence is not success for the gate. The shared
 * `SUITE_SUMMARY_RE` accepts any counted outcome (onboarding's definition):
 * a skipped-only suite is readable, `no tests ran` is not.
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

/**
 * WI-6 (T6, FR-009): the pre-merge review prompt — the reported issue plus the
 * PR diff, judged for wrong-root-cause / wrong-test risk only (not style, not
 * security), under the three-verdict contract `parseReviewOutput` accepts.
 * Only an explicit `approve` lets the merge proceed; the prompt says so.
 */
export function buildReviewPrompt(issue: NormalizedIssue, diff: string): string {
  return `You are reviewing a proposed bug-fix diff against the issue report it claims to fix.
Judge one thing only: wrong-root-cause / wrong-test risk — does this diff actually
address the reported issue, and does its new test test the reported behavior?
This is not a style review and not a security review.

## The reported issue (${issue.id})

${issue.description}

## The diff under review (git diff main...fix branch)

\`\`\`diff
${diff}
\`\`\`

## Required output format

End your output with exactly one block, one of three verdicts, and nothing else inside it:

<review>approve</review>
<review>wrong</review>
<review>uncertain</review>

approve = the diff addresses the reported issue. wrong = it fixes something other
than the report, or its test does not test the reported behavior. uncertain = you
cannot tell.`;
}

export function buildPrBody(
  issue: NormalizedIssue,
  redEvidence: string,
  greenEvidence: string,
  verification: { passed: boolean; newFailures: readonly string[] },
  attachmentFailures?: readonly string[],
  /**
   * WI-6 (D9, FR-003): the review path this PR will actually take. `true`
   * (opted-in profile) → the machine gate chain wording, so a human reading
   * the PR knows merge may already have happened and where the safety net
   * lives. `false`/absent → today's human-review closing, byte-identical.
   * (Default `false` rather than required: TS forbids a required parameter
   * after the optional `attachmentFailures`, and the default keeps every
   * existing call site byte-identical without adaptation.)
   */
  autoMerge: boolean = false,
): string {
  const symptomLine = `Symptom mapping: issue ${issue.id} reported "${issue.description.split("\n")[0].replace(/^#\s*/, "")}" — reproduced by \`${reproTestPath(issue)}\` failing exactly that way, now passing.`;
  const attachmentNote = (attachmentFailures ?? []).length > 0
    ? `\n${attachmentFailures!.map((url) => `attachment fetch failed: ${url}`).join("\n")}\n`
    : "";
  const closing = autoMerge
    ? `This repo is opted into automatic merge: this PR is squash-merged automatically once the
independent fresh-sandbox verification above has passed and a pre-merge diff-review pass
approves; a post-merge canary suite then runs on the base branch and auto-reverts the
merge if it goes red. Human review is still welcome at any time.`
    : `A human reviews and merges this — please judge whether the reproduced symptom matches the report.`;
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

${closing}`;
}

export async function runSingleIssue(input: SingleIssueInput, deps: LoopDeps): Promise<LoopOutcome> {
  const branch = fixBranch(input.issue);

  // FR-002: the gate refuses BEFORE the preflight sandbox — an uncleared repo
  // never spends a container or an API call on an attachment-carrying issue.
  // The refusal is issue-level (no failureKind): the queue continues, because
  // attachment-free issues in the same repo are governed by the WI-1/WI-2 seam.
  //
  // Scan input: the description, extended with the plain-list `| <value>`
  // suffix — the plain-list normalizer moves it out of the description into
  // attachedLog, so a description-only scan would let that URL reach the
  // prompt ungated (and never fetch it when cleared). The other sources stay
  // description-only: a spec-doc `log:` URL is already in the description
  // verbatim (the section body keeps the `log:` line), and a GitHub issue's
  // fenced blocks stay in the description too (`normalizeGitHubIssue` copies
  // the body verbatim; attachedLog is just an extracted copy of the longest
  // one), so their URLs are already scanned there.
  const scanText = input.issue.sourceType === "plain-list" && input.issue.attachedLog !== undefined
    ? `${input.issue.description}\n${input.issue.attachedLog}`
    : input.issue.description;
  const attachmentUrls = discoverAttachmentUrls(scanText);
  try {
    assertClearedForAttachments(input.profile, attachmentUrls, input.repoDir);
  } catch (error) {
    if (!(error instanceof ConfidentialityGateError)) {
      throw error;
    }
    return { branch, failure: error.message };
  }
  // Nesting guard: fix worktrees fork from main, so a committed
  // `.loop-harness` there pre-creates the copyToWorktree destination and
  // Sandcastle's `cp -R <repoDir>/.loop-harness <wt>/.loop-harness` copies the
  // staged copy INSIDE it — the attachment would land at
  // `.loop-harness/.loop-harness/attachments/...` while the prompt promises
  // `.loop-harness/attachments/...`. Abort loudly with the remediation
  // instead, BEFORE the fetch loop: the refusal is zero-side-effect — no
  // fetch, no staged files, no sandbox, no agent spend. Accepted trade
  // (WI-4): a run whose every fetch would have failed previously proceeded
  // body-only; it now refuses pre-fetch. Repo-wide condition, so the failure
  // is harness-level (the queue aborts, it does not grind on).
  if (attachmentUrls.length > 0 && (await deps.pathCommittedOnBranch(input.repoDir, "main", ".loop-harness"))) {
    return {
      branch,
      failure:
        "attachment delivery blocked: main has .loop-harness committed — the sandbox copy would nest " +
        "(.loop-harness/.loop-harness) and the promised attachment path would not exist. Remove it from " +
        "the target repo (git rm -r --cached .loop-harness, commit, push) and re-run.",
      failureKind: "harness",
    };
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
  // WI-8 (FR-001): preflight teardown parity with the WI-7 FR-003 canary
  // idiom — a close()/branch-delete failure AFTER the baseline suite ran is
  // bookkeeping beside the staleness verdict, never over it. One catch covers
  // both steps: a failed close still skips the branch delete, as before.
  let preflightTeardown: string | undefined;
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
    try {
      await pre.close();
      await deps.deleteBranch(input.repoDir, preBranch);
    } catch (error) {
      preflightTeardown = error instanceof Error ? error.message : String(error);
    }
  }
  if (baselineProblem) {
    return {
      branch,
      failure: `Aborted before the fix run — ${baselineProblem}.`,
      failureKind: "harness",
      ...(preflightTeardown !== undefined ? { teardownFailure: preflightTeardown } : {}),
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
      // WI-8 (FR-001): a green-baseline run that later fails verification
      // still carries a preflight teardown failure, if there was one.
      ...(preflightTeardown !== undefined ? { teardownFailure: preflightTeardown } : {}),
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
  let prUrl: string | undefined;
  // WI-8 (FR-001): verification teardown parity. A close() throw in the
  // finally below is caught, never propagated: it rides whichever outcome the
  // try decided — the fail outcome after the finally (WI-11 FR-002), or the
  // PR'd outcome on the green path.
  let sandboxTeardown: string | undefined;
  // WI-11 (FR-002): the three verification failure sites used to return from
  // INSIDE the try, before the finally captured `sandboxTeardown` — a close()
  // throw on those fail() paths was silently dropped. Each now stores its
  // outcome and exits the try; the return happens after the finally, with the
  // teardown reason attached.
  let failOutcome: LoopOutcome | undefined;
  try {
    // Each sandbox is a fresh container: the agent's `pip install -e .` (or
    // equivalent) lived in ITS site-packages, not this one's. Without the
    // install, every test file errors at collection and reads as new failures.
    const install = await sandbox.exec(input.profile.installCmd);
    if (install.exitCode !== 0) {
      failOutcome = await fail(`Verification failed — install command exited ${install.exitCode} in the fresh sandbox.`);
    } else {
      const reproCmd = input.profile.singleTestCmd.replace("{test}", reproTestPath(input.issue));
      const repro = await sandbox.exec(reproCmd);
      const suite = await sandbox.exec(input.profile.testCmd);
      const parsed = parseSuiteOrReject(suite.stdout);
      if (!parsed.ok) {
        failOutcome = await fail(`Verification failed — ${parsed.reason}.`);
      } else {
        const verification = diffVerification({
          baselineFailures: input.profile.baselineFailures,
          postFixFailures: parsed.failures,
          reproTestPassed: repro.exitCode === 0,
        });
        if (!verification.passed) {
          const reason = verification.newFailures.length > 0
            ? `new failures vs baseline: ${verification.newFailures.join(", ")}`
            : "reproduction test did not pass in the fresh sandbox";
          failOutcome = await fail(`Verification failed — ${reason}.`, verification.newFailures);
        } else {
          const title = `[loop] fix ${input.issue.id}: ${input.issue.description.split("\n")[0].replace(/^#\s*/, "")}`;
          const body = buildPrBody(
            input.issue,
            redEvidence,
            greenEvidence,
            verification,
            attachmentFailures,
            input.profile.autoMerge === true,
          );
          assertNoSecrets([title, body], deps.env);

          const pr = await deps.createPr({ repoDir: input.repoDir, title, body, base: "main", head: branch });
          prUrl = pr.url;
        }
      }
    }
  } finally {
    try {
      await sandbox.close();
    } catch (error) {
      sandboxTeardown = error instanceof Error ? error.message : String(error);
    }
  }

  // WI-6 T3 (D3): the auto-merge chain runs AFTER the verification sandbox's
  // finally has closed it — merging (with --delete-branch) deletes the very
  // branch that sandbox sits on. The failed paths returned just above; reaching
  // here means verification green + PR open.
  // WI-8 (FR-001): whichever early sandbox teardown failed rides every PR'd
  // return below — the preflight wins if both did (it happened first).
  const earlyTeardown = preflightTeardown ?? sandboxTeardown;
  if (failOutcome !== undefined) {
    // WI-11 (FR-002): the fail()-path teardown failure rides the decided
    // outcome instead of being dropped. The failure reason and failure-kind
    // are untouched; when both early teardowns failed the preflight still
    // wins, exactly as on the PR'd path.
    return { ...failOutcome, ...(earlyTeardown !== undefined ? { teardownFailure: earlyTeardown } : {}) };
  }
  const prOutcome: LoopOutcome = {
    branch,
    prUrl,
    ...(attachmentFailures.length > 0 ? { attachmentFailures: [...attachmentFailures] } : {}),
    ...(earlyTeardown !== undefined ? { teardownFailure: earlyTeardown } : {}),
  };
  if (prUrl !== undefined && input.profile.autoMerge === true) {
    // WI-6 T6 (FR-009, D7): the BLOCKING pre-merge review pass (see
    // `runPreMergeReview`) — only an explicit approve reaches mergePr; any
    // other outcome returns a PR'd result carrying the skip reason.
    const review = await runPreMergeReview(input, deps, prUrl);
    if (!review.approved) {
      return { ...prOutcome, reviewSkip: review.reviewSkip };
    }
    let mergeCommit: string;
    try {
      mergeCommit = (await deps.mergePr({ repoDir: input.repoDir, prUrl })).mergeCommit;
    } catch (error) {
      // FR-004 safe fallback: no auto-merge, the PR stays open, the run
      // continues — but never silently. A merge failure is not an issue
      // failure: the fix IS verified and PR'd (the queue counts it fixed).
      const reason = error instanceof Error ? error.message : String(error);
      return { ...prOutcome, mergeFailure: `merge failed for ${prUrl}: ${reason}` };
    }

    // WI-6 T4 (D2/D3, FR-005): the post-merge chain — sync main to the merged
    // base, run the canary suite on it, then close or revert per its verdict
    // (`runCanary`).
    return runCanary(input, deps, prOutcome, prUrl, mergeCommit, attachmentFailures);
  }
  return prOutcome;
}

/**
 * WI-6 T6 (FR-009, D7): the BLOCKING pre-merge review pass — after createPr,
 * before mergePr, completing FR-004's order: verification → review → merge.
 * One bounded cheap-model call judging the fix diff against the report. Only
 * an explicit approve returns `approved: true`; anything else — wrong,
 * uncertain (which is also what an unparseable verdict or a failed/unavailable
 * reviewer maps to), or even a diff/prompt failure — skips the merge and
 * comments the skip reason on the PR (best-effort), and the caller leaves the
 * PR open for a human: the run continues.
 */
async function runPreMergeReview(
  input: SingleIssueInput,
  deps: LoopDeps,
  prUrl: string,
): Promise<{ readonly approved: true } | { readonly approved: false; readonly reviewSkip: string }> {
  const branch = fixBranch(input.issue);
  let verdict: ReviewVerdict;
  let reviewNote: string | undefined;
  try {
    const diff = await deps.fixDiff(input.repoDir, branch);
    const reviewPrompt = buildReviewPrompt(input.issue, diff);
    // The prompt reaches a third-party API — guard it before the call, like
    // every other emitted string.
    assertNoSecrets([reviewPrompt], deps.env);
    try {
      const stdout = await deps.runReview({
        cwd: input.repoDir,
        prompt: reviewPrompt,
        imageName: input.imageName,
        agent: input.agent,
        diff,
      });
      verdict = parseReviewOutput(stdout);
    } finally {
      // Runs on the throw path too, so a failed pass never leaks the branch.
      await deps.deleteBranch(input.repoDir, REVIEW_BRANCH);
    }
  } catch (error) {
    verdict = "uncertain";
    reviewNote = error instanceof Error ? error.message : String(error);
  }
  if (verdict !== "approve") {
    const reason =
      verdict === "wrong"
        ? "review verdict: wrong — the diff does not address the reported issue"
        : reviewNote !== undefined
          ? `review unavailable (${reviewNote}) — treated as uncertain`
          : "review verdict: uncertain";
    const skipBody =
      `Auto-merge skipped: ${reason}.\n` +
      `The fix is independently verified in a fresh sandbox; this PR stays open for a human to review and merge.`;
    let commentNote = "";
    try {
      assertNoSecrets([skipBody], deps.env);
      await deps.commentOnPr({ repoDir: input.repoDir, prUrl, body: skipBody });
    } catch (error) {
      commentNote = ` (skip comment FAILED: ${error instanceof Error ? error.message : String(error)})`;
    }
    return { approved: false, reviewSkip: `${reason}${commentNote}` };
  }
  return { approved: true };
}

/**
 * WI-6 T4 (D2/D3, FR-005): the post-merge canary. A third sandbox, on a
 * throwaway branch forked from SYNCED main, runs install + the full suite
 * (the repro test is in the suite now — the merge landed it). Green iff
 * the output is readable AND every parsed failure is in the baseline —
 * the same new-failure rule as diffVerification. The canary runs even
 * though pre-merge verification was green: what it guards is the merge
 * itself (squash semantics, a base that moved). A canary that cannot
 * start is red (FR-005 boundary).
 *
 * WI-7 (FR-002): the one canary precondition that must NOT be treated as
 * red is the sync itself failing — a divergent or broken clone says
 * nothing about the merge, and reverting a possibly-fine merge (or
 * canarying a stale main) would both be wrong. The merge stands but is
 * UNVERIFIED: comment on the PR (best-effort), return a harness-level
 * uncanaried outcome — no prUrl, mirroring `reverted` — and let the queue
 * halt. A human decides: revert manually or re-verify after fixing the
 * clone.
 */
async function runCanary(
  input: SingleIssueInput,
  deps: LoopDeps,
  prOutcome: LoopOutcome,
  prUrl: string,
  mergeCommit: string,
  attachmentFailures: readonly string[],
): Promise<LoopOutcome> {
  const branch = fixBranch(input.issue);
  try {
    await deps.syncMain(input.repoDir);
  } catch (error) {
    const syncFailure = error instanceof Error ? error.message : String(error);
    // WI-8 (FR-003): when a notify handle is configured, the comment pings it —
    // an uncanaried merge is exactly the "needs a human" case the handle is for.
    const handle = input.profile.notifyHandle;
    const commentBody =
      `⚠️ UNCANARIED: this merge (${mergeCommit}) was NOT canaried — syncing the local clone to the merged base failed: ${syncFailure}. ` +
      `The merge stands on the base branch but was never verified there. A human must decide: revert the merge manually or re-verify after fixing the clone.` +
      (handle !== undefined ? ` cc @${handle} — this merge needs a human decision.` : "");
    let commentNote: string;
    try {
      assertNoSecrets([commentBody], deps.env);
      await deps.commentOnPr({ repoDir: input.repoDir, prUrl, body: commentBody });
      commentNote = "posted";
    } catch (commentError) {
      commentNote = `FAILED (${commentError instanceof Error ? commentError.message : String(commentError)})`;
    }
    const uncanaried: UncanariedRecord = {
      id: input.issue.id,
      prUrl,
      mergeCommit,
      syncFailure,
      commentNote,
      ...(handle !== undefined ? { notifyHandle: handle } : {}),
    };
    return {
      branch,
      failure: `⚠️ UNCANARIED MERGE ${input.issue.id}: ${uncanariedDetail(uncanaried)}`,
      failureKind: "harness",
      ...(attachmentFailures.length > 0 ? { attachmentFailures: [...attachmentFailures] } : {}),
      // WI-12 (FR-001, d2): the EARLY origin's teardown reason rides the
      // outcome too — the uncanaried verdict above stands untouched, but the
      // verification sandbox's close() failure is not dropped by it.
      ...(prOutcome.teardownFailure !== undefined ? { teardownFailure: prOutcome.teardownFailure } : {}),
      uncanaried,
    };
  }
  const canaryBranch = `loop/canary-${input.issue.id}`;
  let canaryEvidence: string | undefined;
  let canaryGreen = false;
  // WI-7 (FR-003): a teardown (close / branch-delete) failure, recorded
  // BESIDE the verdict — never over it. The suite that already ran decided
  // `canaryGreen`/`canaryEvidence`; bookkeeping that fails afterwards must
  // not flip a green canary to red (that would revert a good merge) nor
  // overwrite an already-decided evidence string.
  let teardownFailure: string | undefined;
  try {
    const canary = await deps.createFixSandbox({
      cwd: input.repoDir,
      branch: canaryBranch,
      baseBranch: "main",
      imageName: input.imageName,
    });
    try {
      const install = await canary.exec(input.profile.installCmd);
      if (install.exitCode !== 0) {
        canaryEvidence = `canary install command exited ${install.exitCode} on merged main`;
      } else {
        const suite = await canary.exec(input.profile.testCmd);
        const parsed = parseSuiteOrReject(suite.stdout);
        if (!parsed.ok) {
          canaryEvidence = `canary ${parsed.reason}`;
        } else {
          const newFailures = parsed.failures.filter(
            (f) => !input.profile.baselineFailures.includes(f),
          );
          if (newFailures.length > 0) {
            canaryEvidence = `canary new failures vs baseline on merged main: ${newFailures.join(", ")}`;
          } else {
            canaryGreen = true;
          }
        }
      }
    } finally {
      // FR-003: recorded, never thrown past the verdict — a teardown failure
      // that propagated here used to land in the outer catch and overwrite
      // `canaryEvidence` (or bury itself on the green path). Ordering is
      // unchanged: close first, then the branch delete, which a failed close
      // still skips as before.
      try {
        await canary.close();
        await deps.deleteBranch(input.repoDir, canaryBranch);
      } catch (error) {
        teardownFailure = error instanceof Error ? error.message : String(error);
      }
    }
  } catch (error) {
    canaryEvidence = `canary sandbox failed to run: ${error instanceof Error ? error.message : String(error)}`;
  }

  if (canaryGreen) {
    // WI-6 T5 (FR-008, D3 ordering merge → canary → close): the last link of
    // the green chain. Only gh-sourced issues have something external to
    // close — spec-doc/plain-list are a no-op. Best-effort: the fix is
    // merged and canary-green, so closing is bookkeeping; a failure is
    // recorded loudly on the merged outcome, never thrown (FR-008 boundary).
    let closeFailure: string | undefined;
    if (input.issue.sourceType === "github-issue") {
      const closeComment =
        `Closed by the fix loop: the fix PR ${prUrl} was squash-merged ` +
        `(merge commit ${mergeCommit}) and the post-merge canary suite on the base ` +
        `branch is green — no new failures versus the onboarding baseline.`;
      try {
        assertNoSecrets([closeComment], deps.env);
        await deps.closeIssue(input.repoDir, input.issue, closeComment);
      } catch (error) {
        closeFailure =
          `issue close failed for ${input.issue.url ?? input.issue.id}: ` +
          `${error instanceof Error ? error.message : String(error)}`;
      }
    }
    return {
      ...prOutcome,
      merged: { prUrl, mergeCommit, canaryGreen: true },
      ...(closeFailure !== undefined ? { closeFailure } : {}),
      // FR-003: the merged outcome stands; the teardown failure rides beside it.
      // WI-11 (FR-001, decision d1): the canary's teardown failure gets its OWN
      // origin-labeled field — spreading `prOutcome` keeps the early
      // `teardownFailure` (preflight/verification) instead of the pre-WI-11
      // overwrite, so a run where both sandboxes' teardowns failed carries both
      // reasons, neither displacing the other.
      ...(teardownFailure !== undefined ? { canaryTeardownFailure: teardownFailure } : {}),
    };
  }

  // WI-6 T4 (FR-006/FR-007): red main is a stop-the-line event. Revert
  // (best-effort), notify on the merged PR (best-effort), then return a
  // harness-level failure — the queue halts on it and the CLI exits 1.
  // Deliberately NO prUrl/merged on this outcome: a reverted issue is not
  // fixed, and splitQueue's revert guard keeps it queued (FR-006).
  const evidence = canaryEvidence ?? "canary went red";
  let revertCommit: string | undefined;
  let revertFailure: string | undefined;
  let revertNote: string;
  try {
    revertCommit = (await deps.revertMerge({ repoDir: input.repoDir, mergeCommit })).revertCommit;
    revertNote = `revert: ${revertCommit}`;
  } catch (error) {
    revertFailure = error instanceof Error ? error.message : String(error);
    revertNote = `revert: FAILED (${revertFailure})`;
  }
  const handle = input.profile.notifyHandle;
  const commentBody = [
    `${handle !== undefined ? `@${handle} ` : ""}⚠️ REVERTED: the merge of this PR (${mergeCommit}) was automatically reverted.`,
    `The post-merge canary suite on main went red — ${evidence}.`,
    revertCommit !== undefined
      ? `Revert commit: ${revertCommit}.`
      : `The revert itself FAILED: ${revertFailure}.`,
    "The run has been halted; the issue returns to the queue for a human decision.",
  ].join("\n");
  let commentNote: string;
  try {
    assertNoSecrets([commentBody], deps.env);
    await deps.commentOnPr({ repoDir: input.repoDir, prUrl, body: commentBody });
    commentNote = "comment: posted";
  } catch (error) {
    commentNote = `comment: FAILED (${error instanceof Error ? error.message : String(error)})`;
  }
  return {
    branch,
    failure:
      `⚠️ REVERTED ${input.issue.id}: merge ${mergeCommit} reverted after canary went red — ` +
      // WI-11 (FR-003): absent handle renders the unified "notify handle not
      // configured" vocabulary — no colon, matching the uncanaried-merge
      // detail and the queue's REVERTED line. WI-12 (FR-002, decision d1)
      // unifies the present-handle arm on `notify: @<handle>` too, matching
      // the uncanaried detail and the queue REVERTED line; the bare form
      // (live-observed in WI-10, deliberately pinned by WI-11 FR-003) is
      // superseded.
      `${evidence}; ${revertNote}; ${commentNote}; ` +
      (handle !== undefined ? `notify: @${handle}` : "notify handle not configured"),
    failureKind: "harness",
    ...(attachmentFailures.length > 0 ? { attachmentFailures: [...attachmentFailures] } : {}),
    // WI-11 (FR-001, decision d1): the EARLY origin's reason rides the outcome
    // itself (the FAILED line's teardown suffix and the single-issue report read
    // it), while the canary reason keeps its WI-7 home in
    // `reverted.teardownFailure` below — two origins, two labeled homes.
    ...(prOutcome.teardownFailure !== undefined ? { teardownFailure: prOutcome.teardownFailure } : {}),
    reverted: {
      id: input.issue.id,
      prUrl,
      mergeCommit,
      ...(revertCommit !== undefined
        ? { revertCommit }
        : { revertFailure: revertFailure ?? "unknown revert failure" }),
      evidence,
      // FR-003: teardown failure named in the record — never appended to
      // `evidence`, which stands as the canary suite decided it.
      ...(teardownFailure !== undefined ? { teardownFailure } : {}),
      ...(handle !== undefined ? { notifyHandle: handle } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// WI-2: queue mode — sequential runner over the admitted queue (FR-004/FR-005).
// ---------------------------------------------------------------------------

/** Everything the queue runner needs beyond the single-issue loop. */
export type QueueLoopDeps = LoopDeps & QueueDeps & {
  runPlan(input: PlanRunInput): Promise<string>;
};

export interface QueueRunInput {
  readonly ghRepo: string;
  readonly repoDir: string;
  readonly imageName: string;
  readonly agent: AgentSpec;
  readonly profile: ProjectProfile;
  readonly label?: string;
  /**
   * WI-13 (FR-005): an EXPLICIT optional ceiling — `--max-issues N` when
   * passed; absent (`undefined`), every unblocked issue the plan surfaced runs.
   * No default. Validated (integer ≥ 1) by the CLI at startup when present.
   */
  readonly cap: number | undefined;
  /**
   * WI-3 (FR-007): a pre-parsed queue from `--spec-doc` / `--plain-list`.
   * When present it REPLACES GitHub acquisition — `ghJson` is never called.
   */
  readonly sourceIssues?: readonly NormalizedIssue[];
  /** Label for the run summary, e.g. `spec-doc (docs/spec.md)`. */
  readonly sourceName?: string;
}

export interface QueueSummary {
  readonly attempted: string[];
  readonly fixed: string[];
  readonly failed: [string, string][];
  readonly skippedDuplicate: string[];
  /** Ids a merged PR already fixed — done, not re-admitted (WI-6 FR-002). */
  readonly skippedMerged: string[];
  /**
   * [id, reason] — WI-13 FR-005: `"cap"` when the explicit ceiling cut an
   * issue the plan surfaced. (`"blocked by <ids>"` joins with the dependency
   * edges in T6.)
   */
  readonly notAdmitted: [string, string][];
  /** [id, url] — attachment fetches that failed (FR-004); notes, never gates. */
  readonly attachmentFailures: [string, string][];
  readonly prUrls: string[];
  /**
   * [id, prUrl, mergeCommit] — auto-merged (opted-in) verified PRs (WI-6).
   * WI-7 (FR-003) tuple growth: a 4th `teardownFailure` element is appended
   * when the canary's teardown failed on an otherwise-green merge — the MERGED
   * summary line names it inline, so it rides the existing tuple rather than
   * a parallel summary field. WI-11 (FR-001, ponytail): that 4th element is
   * the PRE-COMPOSED teardown suffix (label included) naming each failed
   * origin — `teardown: <reason>` when exactly one origin failed (byte-identical
   * to the WI-7 rendering), `teardown: <early>; canary teardown: <canary>`
   * when both did. Still 4 slots, never 5.
   */
  readonly mergedPrs: [string, string, string, string?][];
  /**
   * [id, reason] — auto-merge attempts that failed (WI-6 FR-004). Deliberate
   * choice: NOT a `failed` entry — the issue is fixed, verified, and PR'd; the
   * PR is real work and the queue continues. The failure still needs a loud,
   * named surface of its own (`MERGE FAILED` lines), never silence.
   */
  readonly mergeFailures: [string, string][];
  /**
   * [id, reason] — WI-6 (FR-008): closing a gh-sourced issue after a
   * canary-green merge failed. Like `mergeFailures` this is a loud note of
   * its own (`ISSUE CLOSE FAILED` lines), never a `failed` entry — the merge
   * stands and the queue continues.
   */
  readonly closeFailures: [string, string][];
  /**
   * [id, reason] — WI-6 (FR-009): merges the pre-merge review pass blocked
   * (wrong / uncertain / reviewer unavailable). Mirrors `mergeFailures`: a
   * loud note of its own (`REVIEW SKIP` lines), never a `failed` entry — the
   * fix is verified and PR'd, and the queue continues.
   */
  readonly reviewSkipped: [string, string][];
  /**
   * WI-6 (FR-006/FR-007): canary-red reverts — each halted the run (see the
   * FAILED lines for the message), was reverted on main (or failed loudly),
   * and stays queued for a later run. Snapshotted even on the abort path.
   */
  readonly reverted: RevertedRecord[];
  /**
   * [id, detail] — WI-7 (FR-002): merges that landed but were never canaried
   * (the post-merge main sync failed). Like `reverted` each halted the run
   * (see the FAILED lines), but nothing was reverted — the merge is
   * unverified, not judged red. Own loud summary surface
   * (`⚠️ UNCANARIED MERGE` lines); snapshotted even on the abort path.
   */
  readonly uncanariedMerges: [string, string][];
  /** Source label (WI-3 FR-007) — set only for non-GitHub queue sources. */
  readonly source?: string;
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
 * Run the queue: acquire → dedup → plan (when >1 eligible, WI-13 FR-001) →
 * rank + optional ceiling (WI-13 FR-005) → run each admitted issue
 * sequentially through runSingleIssue. An issue-level failure is recorded and
 * the queue continues; a harness-level failure (stale baseline, credentials)
 * aborts with a `QueueAbortedError` whose `summary` holds the partial run —
 * the caller prints both that and the abort reason.
 */
export async function runQueue(input: QueueRunInput, deps: QueueLoopDeps): Promise<QueueSummary> {
  // FR-007: a preset source (--spec-doc / --plain-list) replaces acquisition —
  // dedup, the planner, the cap, and the loop itself are identical from here on.
  const issues = input.sourceIssues !== undefined
    ? [...input.sourceIssues]
    : await listOpenIssues(deps, {
        repo: input.ghRepo,
        ...(input.label !== undefined ? { label: input.label } : {}),
      });
  const split = await splitQueue(deps, input.repoDir, issues);

  // WI-13 FR-001: the planner is always on when more than one issue is
  // eligible — the dependency graph it returns is what lets independent fixes
  // run in parallel. One eligible issue can block nobody and outrank nobody,
  // so it never buys a model call.
  let plan: PlanValue | undefined;
  let planUnusable = false;
  let planError: string | undefined;
  if (split.eligible.length > 1) {
    const prompt = buildPlanPrompt(split.eligible);
    assertNoSecrets([prompt], deps.env);
    try {
      const stdout = await deps.runPlan({
        cwd: input.repoDir,
        prompt,
        imageName: input.imageName,
        agent: input.agent,
      });
      plan = parsePlanOutput(stdout, split.eligible.map((i) => i.id));
    } catch (error) {
      // The planning pass is an optimization, never a gate: a failed plan run
      // degrades the ordering, it does not cost the queue its issues.
      planError = error instanceof Error ? error.message : String(error);
    } finally {
      // Runs on the throw path too, so a failed pass never leaks the branch.
      await deps.deleteBranch(input.repoDir, PLAN_BRANCH);
    }
    planUnusable = plan === undefined;
  }

  // WI-13 FR-005 (T4): admission is rank + slice inline — `admitIssues` is
  // dissolved, its interim plan-fed bridge with it. The plan ranks
  // (`orderFromPlan`), the explicit ceiling slices the ranked order, and the
  // remainder is recorded not-admitted with reason "cap". Absent a ceiling,
  // every issue the plan surfaced attempts. File-overlap deferral is gone:
  // the plan carries no file data, and serialization moves to the dependency
  // edges (T5/T6).
  const ranked = orderFromPlan(split.eligible, plan);
  const admitted =
    input.cap === undefined ? ranked : ranked.slice(0, input.cap);
  const notAdmitted: [string, string][] =
    input.cap === undefined
      ? []
      : ranked.slice(input.cap).map((issue) => [issue.id, "cap"] as [string, string]);
  if (planUnusable) {
    // The reason can quote a subprocess error, so it passes the guard like any
    // other emitted string before it reaches a terminal or an evidence log.
    const warning = `[queue] WARNING: plan unusable (${planError ?? "output failed validation"}) — falling back to deterministic order (ascending issue number).`;
    assertNoSecrets([warning], deps.env);
    console.error(warning);
  }

  // WI-13 FR-005: the surfaced plan prints BEFORE any fix-agent spend — the
  // operator sees what the run will attempt (and what the ceiling cut) before
  // the first lane starts. Per-issue lines are attempt/cap only here; the
  // blocked-by vocabulary joins with the dependency edges (T5/T6). Every line
  // passes the secrets guard at this emission seam like all emitted strings.
  const planLines = [
    input.cap === undefined ? "plan: all unblocked" : `plan: attempted ≤ ${input.cap}`,
    ...admitted.map((issue) => `plan: attempt ${issue.id}`),
    ...notAdmitted.map(([id]) => `plan: cap ${id}`),
  ];
  assertNoSecrets(planLines, deps.env);
  for (const line of planLines) {
    console.log(line);
  }

  const attempted: string[] = [];
  const fixed: string[] = [];
  const failed: [string, string][] = [];
  const attachmentFailures: [string, string][] = [];
  const prUrls: string[] = [];
  const mergedPrs: [string, string, string, string?][] = [];
  const mergeFailures: [string, string][] = [];
  const closeFailures: [string, string][] = [];
  const reviewSkipped: [string, string][] = [];
  const reverted: RevertedRecord[] = [];
  const uncanariedMerges: [string, string][] = [];
  const snapshot = (): QueueSummary => ({
    attempted: [...attempted],
    fixed: [...fixed],
    failed: [...failed],
    skippedDuplicate: split.skippedDuplicate,
    skippedMerged: split.skippedMerged,
    notAdmitted: [...notAdmitted],
    attachmentFailures: [...attachmentFailures],
    prUrls: [...prUrls],
    mergedPrs: [...mergedPrs],
    mergeFailures: [...mergeFailures],
    closeFailures: [...closeFailures],
    reviewSkipped: [...reviewSkipped],
    reverted: [...reverted],
    uncanariedMerges: [...uncanariedMerges],
    ...(input.sourceName !== undefined ? { source: input.sourceName } : {}),
  });

  for (const issue of admitted) {
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
    // WI-6 T4: collected before the abort below — the aborting snapshot still
    // carries the ⚠️ REVERTED record for the summary.
    if (outcome.reverted !== undefined) {
      reverted.push(outcome.reverted);
    }
    // WI-7 (FR-002): same pattern — the record is collected before the abort
    // throw so the aborting summary still carries the ⚠️ UNCANARIED MERGE line.
    if (outcome.uncanaried !== undefined) {
      uncanariedMerges.push([outcome.uncanaried.id, uncanariedDetail(outcome.uncanaried)]);
    }
    if (outcome.prUrl) {
      fixed.push(issue.id);
      prUrls.push(outcome.prUrl);
      // WI-6: a merged or failed-to-merge outcome still counts as fixed (see
      // QueueSummary.mergeFailures for why a merge failure is not an issue
      // failure); both get their own loud summary surfaces.
      if (outcome.merged !== undefined) {
        // WI-11 (FR-001, ponytail 2026-09-19): the 4th element is the
        // PRE-COMPOSED teardown suffix, built here at push time so the tuple
        // stays 4 slots and formatSummary interpolates it unchanged in shape.
        // Exactly one failed origin renders `teardown: <reason>` byte-identical
        // to today's single-failure rendering (whichever origin it was); both
        // failed renders both, origin-labeled.
        const earlyTeardown = outcome.teardownFailure;
        const canaryTeardown = outcome.canaryTeardownFailure;
        const teardownSuffix =
          earlyTeardown !== undefined && canaryTeardown !== undefined
            ? `teardown: ${earlyTeardown}; canary teardown: ${canaryTeardown}`
            : earlyTeardown !== undefined || canaryTeardown !== undefined
              ? `teardown: ${earlyTeardown ?? canaryTeardown}`
              : undefined;
        mergedPrs.push(
          teardownSuffix !== undefined
            ? [issue.id, outcome.merged.prUrl, outcome.merged.mergeCommit, teardownSuffix]
            : [issue.id, outcome.merged.prUrl, outcome.merged.mergeCommit],
        );
      }
      if (outcome.mergeFailure !== undefined) {
        mergeFailures.push([issue.id, outcome.mergeFailure]);
      }
      if (outcome.closeFailure !== undefined) {
        closeFailures.push([issue.id, outcome.closeFailure]);
      }
      if (outcome.reviewSkip !== undefined) {
        reviewSkipped.push([issue.id, outcome.reviewSkip]);
      }
      continue;
    }
    // A repo-wide preflight abort (stale baseline) will fail every remaining
    // issue identically — that is a harness-level failure, not this issue's.
    // WI-8 (FR-001): a teardown failure beside the verdict rides the FAILED
    // line as a suffix — the reason itself stands untouched.
    failed.push([
      issue.id,
      `${outcome.failure ?? "unknown failure"}${outcome.teardownFailure !== undefined ? ` (teardown: ${outcome.teardownFailure})` : ""}`,
    ]);
    if (outcome.failureKind === "harness") {
      throw new QueueAbortedError(`Queue aborted — ${issue.id}: ${outcome.failure}`, snapshot());
    }
  }

  return snapshot();
}

export function formatSummary(summary: QueueSummary): string {
  return [
    ...(summary.source !== undefined ? [`source: ${summary.source}`] : []),
    `Run summary — attempted: ${summary.attempted.length} (fixed: ${summary.fixed.length}, failed: ${summary.failed.length}) | skipped-duplicate: ${summary.skippedDuplicate.length} | skipped-merged: ${summary.skippedMerged.length} | not-admitted: ${summary.notAdmitted.length}`,
    ...summary.prUrls.map((url) => `PR: ${url}`),
    // A mergedPrs entry exists only on a canary-green merge (red reverts and
    // never reaches this list), so the canary result is pinned here (T4
    // spec-review follow-up): a MERGED line without it hides the gate. WI-7
    // (FR-003): a 4th tuple element names a teardown failure on that merge.
    // WI-11 (FR-001): that element is now the pre-composed suffix (label
    // included), so it interpolates unchanged whether one origin failed or both.
    ...summary.mergedPrs.map(
      ([id, url, mergeCommit, teardownSuffix]) =>
        `MERGED ${id}: ${url} @ ${mergeCommit} (canary: green${teardownSuffix !== undefined ? `; ${teardownSuffix}` : ""})`,
    ),
    ...summary.reverted.map(
      (r) =>
        `⚠️ REVERTED ${r.id}: pr ${r.prUrl} merge ${r.mergeCommit} revert ` +
        `${r.revertCommit ?? `FAILED (${r.revertFailure ?? "unknown"})`} — canary: ${r.evidence}` +
        `${r.teardownFailure !== undefined ? `; teardown: ${r.teardownFailure}` : ""}\n` +
        (r.notifyHandle !== undefined ? `notify: @${r.notifyHandle}` : "notify handle not configured"),
    ),
    ...summary.uncanariedMerges.map(([id, detail]) => `⚠️ UNCANARIED MERGE ${id}: ${detail}`),
    ...summary.mergeFailures.map(([id, reason]) => `MERGE FAILED ${id}: ${reason}`),
    ...summary.closeFailures.map(([id, reason]) => `ISSUE CLOSE FAILED ${id}: ${reason}`),
    ...summary.reviewSkipped.map(([id, reason]) => `REVIEW SKIP ${id}: auto-merge not performed — ${reason}`),
    ...summary.failed.map(([id, reason]) => `FAILED ${id}: ${reason}`),
    ...summary.attachmentFailures.map(([id, url]) => `ATTACHMENT FAILED ${id}: ${url}`),
    ...summary.notAdmitted.map(([id, reason]) => `NOT ADMITTED ${id}: ${reason}`),
  ].join("\n");
}

/**
 * `--max-issues` (WI-13 FR-005: an explicit optional ceiling, no default) is
 * validated at startup when passed, before any acquisition or spend.
 */
export function parseCap(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`--max-issues must be an integer >= 1 (got "${raw}")`);
  }
  return n;
}

/**
 * WI-13 (FR-009): `--triage` is retired — the dependency-aware planner
 * replaced it and always runs when more than one issue is eligible. Passing
 * the dead flag is a startup error naming the replacement, thrown before any
 * env load, acquisition, clone, or sandbox spend.
 */
export function parseRetiredFlags(argv: readonly string[]): void {
  if (argv.includes("--triage")) {
    throw new Error(
      "--triage was removed — the dependency-aware planner now always runs when more than one issue is eligible",
    );
  }
}

/** A source-selection problem (combined flags, missing/unreadable file) — WI-3. */
export class SourceSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceSelectionError";
  }
}

export interface SourceSelection {
  /** The pre-parsed queue — replaces GitHub acquisition entirely (FR-007). */
  readonly issues: readonly NormalizedIssue[];
  /** Summary label, e.g. `spec-doc (docs/spec.md)`. */
  readonly sourceName: string;
}

/**
 * `--spec-doc <path>` / `--plain-list <path>` (WI-3, FR-007): read and parse
 * the named issue source at startup. Returns `undefined` when neither flag is
 * given (the GitHub default). Parse errors from the normalizers
 * (`SpecDocParseError`, `PlainListParseError`) propagate verbatim; everything
 * else about the selection is a `SourceSelectionError` — all thrown before any
 * worktree or sandbox work.
 */
export function parseSourceArgs(argv: readonly string[]): SourceSelection | undefined {
  const specAt = argv.indexOf("--spec-doc");
  const listAt = argv.indexOf("--plain-list");
  if (specAt === -1 && listAt === -1) {
    return undefined;
  }
  if (specAt !== -1 && listAt !== -1) {
    throw new SourceSelectionError(
      "--spec-doc and --plain-list: sources cannot be combined — pick one issue source",
    );
  }
  // A preset source replaces GitHub acquisition entirely, so the GitHub-only
  // flags would be silently ignored (T5 review: loud, never silent).
  if (argv.includes("--issue")) {
    throw new SourceSelectionError(
      "--issue cannot be combined with --spec-doc/--plain-list — the source file replaces GitHub acquisition",
    );
  }
  if (argv.includes("--label")) {
    throw new SourceSelectionError(
      "--label cannot be combined with --spec-doc/--plain-list — labels only filter GitHub acquisition",
    );
  }
  const flag = specAt !== -1 ? "spec-doc" : "plain-list";
  const at = specAt !== -1 ? specAt : listAt;
  const path = argv[at + 1];
  if (path === undefined || path.startsWith("--")) {
    throw new SourceSelectionError(`missing --${flag} <path>`);
  }
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new SourceSelectionError(
      `cannot read --${flag} file "${path}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const issues = flag === "spec-doc" ? parseSpecDoc(text) : parsePlainList(text);
  return { issues, sourceName: `${flag} (${path})` };
}

export type OverrideOutcome =
  | { readonly kind: "skipped-duplicate"; readonly id: string }
  | { readonly kind: "skipped-merged"; readonly id: string }
  | { readonly kind: "run"; readonly outcome: LoopOutcome };

/**
 * `--issue N` single-issue override: no cap, no planner — the user named the
 * issue — but dedup still applies, open (in flight) and merged (done) alike
 * (decision 6; WI-6 FR-002). Also cleans a stale fix branch for the named
 * issue so the retry starts from clean main.
 */
export async function runOverrideIssue(
  input: SingleIssueInput,
  deps: LoopDeps & QueueDeps,
): Promise<OverrideOutcome> {
  const split = await splitQueue(deps, input.repoDir, [input.issue]);
  if (split.skippedDuplicate.includes(input.issue.id)) {
    return { kind: "skipped-duplicate", id: input.issue.id };
  }
  if (split.skippedMerged.includes(input.issue.id)) {
    return { kind: "skipped-merged", id: input.issue.id };
  }
  return { kind: "run", outcome: await runSingleIssue(input, deps) };
}

/**
 * WI-8 (FR-002): the single-issue CLI report as a PURE builder — `main()` emits
 * `stdout` via console.log and guards EACH `stderr` line through
 * `assertNoSecrets` before console.error (the guard stays at the emission
 * seam, never in here). The branch logic is `main()`'s former print block,
 * moved verbatim: exitCode 1 only on the no-PR branch, every skipped kind a
 * single stdout line at exit 0.
 */
export function formatSingleIssueResult(result: OverrideOutcome): {
  stdout: string[];
  stderr: string[];
  exitCode: 0 | 1;
} {
  if (result.kind === "skipped-duplicate") {
    return {
      stdout: [`[${result.id}] skipped — an open PR already covers it`],
      stderr: [],
      exitCode: 0,
    };
  }
  if (result.kind === "skipped-merged") {
    return {
      stdout: [`[${result.id}] skipped — a merged PR already covers it`],
      stderr: [],
      exitCode: 0,
    };
  }
  if (result.outcome.prUrl) {
    const stdout = [`PR opened: ${result.outcome.prUrl}`];
    const stderr: string[] = [];
    // WI-6: there is always a prUrl on the merge-failure path — the PR is the
    // deliverable, so the run stays green (exit 0) and a human can still
    // merge it. The failure is loud, never silent, but never fatal here.
    if (result.outcome.mergeFailure !== undefined) {
      stderr.push(`auto-merge failed: ${result.outcome.mergeFailure}`);
    }
    if (result.outcome.merged !== undefined) {
      stdout.push(`Merged: ${result.outcome.merged.prUrl} @ ${result.outcome.merged.mergeCommit}`);
    }
    // WI-6 (FR-008): a failed close is bookkeeping noise on a merged outcome
    // — loud (guarded, stderr), never fatal.
    if (result.outcome.closeFailure !== undefined) {
      stderr.push(`issue close failed: ${result.outcome.closeFailure}`);
    }
    // WI-8 (FR-002): a preflight/verification teardown failure on a PR'd run
    // is bookkeeping — loud on stderr, never fatal: the PR is the deliverable,
    // the run stays green.
    if (result.outcome.teardownFailure !== undefined) {
      stderr.push(`sandbox teardown failed: ${result.outcome.teardownFailure}`);
    }
    // WI-11 (FR-001): the canary origin gets its own labeled line when it too
    // failed on a merged run — the line above already names the early origin.
    if (result.outcome.canaryTeardownFailure !== undefined) {
      stderr.push(`canary teardown failed: ${result.outcome.canaryTeardownFailure}`);
    }
    return { stdout, stderr, exitCode: 0 };
  }
  // Code-review finding (WI-6, standards axis): the failure text quotes
  // subprocess errors (the WI-6 revert path made this string class much
  // richer). WI-8 moved guarding to the CLI entry: this builder is pure and
  // never sees the guard env — each stderr line below is guarded at the
  // actual emission seam in `main`, like every other emitted string.
  const stderr = [`Loop finished without a PR — ${result.outcome.failure}`];
  // WI-8 (FR-002): the teardown line rides after the failure line — recorded,
  // never deciding the outcome that was already earned.
  if (result.outcome.teardownFailure !== undefined) {
    stderr.push(`sandbox teardown failed: ${result.outcome.teardownFailure}`);
  }
  return {
    stdout: [],
    stderr,
    exitCode: 1,
  };
}

// ---------------------------------------------------------------------------
// CLI entry (WI-2: queue mode is the default; --issue N is the override):
// npm run loop -- --repo <dir-or-owner/name> [--issue <n>] [--label <label>]
//                [--max-issues <n>]
//                [--spec-doc <path> | --plain-list <path>]  (WI-3: replaces
//                GitHub issue acquisition with a pre-parsed source)
//                --provider <name>
// --issue and --label are GitHub-source-only: combining either with
// --spec-doc/--plain-list is a startup error (WI-3 T5b).
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

  // WI-13 (FR-009): retired-flag rejection comes first — pure argv validation,
  // before any env load, acquisition, clone, worktree, or sandbox spend.
  parseRetiredFlags(args);
  const repoArg = flag("repo");
  const issueArg = optFlag("issue");
  const providerName = flag("provider");
  const imageName = optFlag("image") ?? "sandcastle-loop";
  const modelOverride = optFlag("model");
  // WI-13 (FR-005): the ceiling is optional and has NO default — absent the
  // flag, every unblocked issue the planner surfaces runs. A passed value is
  // still validated here, before any acquisition or spend.
  const maxIssuesArg = optFlag("max-issues");
  const cap = maxIssuesArg === undefined ? undefined : parseCap(maxIssuesArg);
  const label = optFlag("label");
  // WI-3 (FR-007): validated and parsed before any env load, clone, worktree,
  // or sandbox — a bad source costs nothing.
  const source = parseSourceArgs(args);

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
    // Nesting-guard evidence: ls-tree lists the path only when it is committed
    // on the named branch (the working tree and untracked staging never show).
    async pathCommittedOnBranch(repoDir, branch, path) {
      const stdout = execFileSync("git", ["ls-tree", "--name-only", branch, "--", path], {
        cwd: repoDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return stdout.trim().length > 0;
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
    // WI-6 (T6, FR-009, D7): the change the pre-merge review pass judges —
    // the three-dot diff from main to the fix branch.
    async fixDiff(dir: string, diffBranch: string) {
      return execFileSync("git", ["diff", `main...${diffBranch}`], {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    },
    // WI-6 (T6, FR-009): the bounded cheap-model review run itself (the only
    // Sandcastle import stays in the adapter).
    runReview,
    // WI-6 (D1, FR-004): squash keeps main linear; --delete-branch cleans the
    // fix branch remote+local — the merged PR itself stays queryable. Any
    // non-zero gh exit throws; runSingleIssue catches and falls back safely.
    async mergePr({ repoDir: dir, prUrl }) {
      execFileSync(
        "gh",
        ["pr", "merge", prUrl, "--squash", "--delete-branch"],
        { cwd: dir, stdio: "inherit" },
      );
      const mergeCommit = execFileSync(
        "gh",
        ["pr", "view", prUrl, "--json", "mergeCommit", "-q", ".mergeCommit.oid"],
        { cwd: dir, encoding: "utf8" },
      ).trim();
      return { mergeCommit };
    },
    // WI-6 (D3, FR-005): fast-forward local main to origin's before the canary.
    // A divergent main refuses the update, exits non-zero, and throws — loud,
    // and before any canary spend. See syncMainToOrigin for why this is not a
    // bare `git fetch origin main:main` (checked-out main; T7 live finding).
    async syncMain(dir: string) {
      syncMainToOrigin(dir);
    },
    // WI-6 (D4, FR-006): revert the squash merge on main and push the revert;
    // the revert commit is HEAD after `git revert`.
    async revertMerge({ repoDir: dir, mergeCommit }) {
      execFileSync("git", ["revert", "--no-edit", mergeCommit], { cwd: dir, stdio: "inherit" });
      execFileSync("git", ["push", "origin", "main"], { cwd: dir, stdio: "inherit" });
      const revertCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
      return { revertCommit };
    },
    // WI-6 (FR-007): the @-mention revert notification lands on the merged PR.
    async commentOnPr({ repoDir: dir, prUrl, body }) {
      execFileSync("gh", ["pr", "comment", prUrl, "--body", body], { cwd: dir, stdio: "inherit" });
    },
    // WI-6 (FR-008): close the gh-sourced issue with its evidence comment; the
    // issue number is the last path segment of the issue url.
    async closeIssue(dir: string, issueToClose: NormalizedIssue, comment: string) {
      execFileSync("gh", ["issue", "close", issueNumberFromUrl(issueToClose.url), "--comment", comment], {
        cwd: dir,
        stdio: "inherit",
      });
    },
  };

  // Real QueueDeps wiring: gh + git subprocesses against the target clone.
  const queueDeps: QueueDeps & { runPlan(input: PlanRunInput): Promise<string> } = {
    ghJson: realGhJson,
    // WI-7 (FR-001): refresh the clone's remote-tracking refs before the dedup
    // reads them — the revert guard and branch listings describe origin's now,
    // not whatever the clone last fetched. `--prune` also drops remote-tracking
    // refs for branches deleted on origin (same rationale as syncMainToOrigin).
    async refreshRemoteRefs(dir) {
      execFileSync("git", ["fetch", "--prune", "origin"], { cwd: dir, stdio: "inherit" });
    },
    async listOpenPrs(dir) {
      return JSON.parse(realGhJson(prListArgs("open"), dir)) as OpenPr[];
    },
    async listMergedPrs(dir) {
      return JSON.parse(realGhJson(prListArgs("merged"), dir)) as MergedPr[];
    },
    // WI-6 (D4, FR-006): main's history says whether this merged PR was
    // reverted — `git revert` of gh's squash merge produces a subject
    // `Revert "<original subject (#N)>"`, so a `Revert "` line carrying the
    // PR's own `(#N)` tag means the merge is undone and its issue goes back
    // to todo.
    async mainRevertsPr({ repoDir: dir, pr }) {
      const subjects = execFileSync("git", ["log", "--format=%s", "origin/main"], {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).split("\n");
      const tag = `(#${pr.number})`;
      return subjects.some((s) => s.startsWith('Revert "') && s.includes(tag));
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
    runPlan,
  };
  const allDeps = { ...deps, ...queueDeps };

  if (issueArg !== undefined) {
    // Single-issue override (decision 6): no cap, no planner, dedup applies.
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
    const report = formatSingleIssueResult(result);
    for (const line of report.stdout) {
      console.log(line);
    }
    // WI-8 (FR-002): each stderr line is guarded at the emission seam — the
    // builder is pure and never sees the guard env (same posture as the
    // former inline block: the reason strings quote subprocess errors).
    for (const line of report.stderr) {
      assertNoSecrets([line], guardEnv);
      console.error(line);
    }
    if (report.exitCode === 1) {
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
        {
          ghRepo,
          repoDir,
          imageName,
          agent,
          profile,
          ...(label !== undefined ? { label } : {}),
          cap,
          ...(source !== undefined
            ? { sourceIssues: source.issues, sourceName: source.sourceName }
            : {}),
        },
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

/**
 * WI-6 (FR-008): the issue number for `gh issue close`, from the issue url —
 * the last path segment (`…/issues/42` → `"42"`). A gh-sourced issue always
 * carries a url ending in its number; anything else is a harness bug, thrown
 * loudly so the close step records it instead of closing the wrong issue.
 */
function issueNumberFromUrl(url: string | undefined): string {
  const last = url?.split("/").filter(Boolean).pop();
  if (last === undefined || !/^\d+$/.test(last)) {
    throw new Error(`cannot derive an issue number from issue url "${url ?? "(none)"}"`);
  }
  return last;
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
