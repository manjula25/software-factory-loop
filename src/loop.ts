/**
 * Single-issue fix loop (FR-005 identity, FR-103 machinery): normalize →
 * reproduce → fix in a sandbox → verify in a FRESH sandbox → PR with verbatim
 * RED/GREEN evidence. The agent's own completion signal is never trusted; the
 * gate is `diffVerification` on output from a sandbox the agent never touched.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertNoSecrets } from "./assert-no-secrets.js";
import { loadEnv, readEnvFile } from "./env.js";
import { normalizeGitHubIssue, type GitHubIssueInput, type NormalizedIssue } from "./issues.js";
import { resolveProvider } from "./providers.js";
import { createFixSandbox, runFixRun, type AgentSpec } from "./sandcastle-adapter.js";
import { diffVerification, parsePytestFailures } from "./verify.js";

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
  }): Promise<{ stdout: string; commits: readonly { sha: string }[]; branch: string }>;
  createFixSandbox(input: {
    cwd: string;
    branch: string;
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
  readonly newFailures?: readonly string[];
}

/** Deterministic home for the reproduction test (constraint 4: it stays in the suite). */
export function reproTestPath(issue: NormalizedIssue): string {
  return `tests/fixed-issues/test_${issue.id.replace(/-/g, "_")}.py`;
}

export function fixBranch(issue: NormalizedIssue): string {
  return `fix/${issue.id}`;
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

export function buildFixPrompt(issue: NormalizedIssue, profile: ProjectProfile): string {
  return `You are fixing one reported issue in this repository.

## The issue (${issue.id})

${issue.description}
${issue.attachedLog ? `\n## Attached log from the report\n\n\`\`\`\n${issue.attachedLog}\n\`\`\`\n` : ""}
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
4. Commit everything — fix and reproduction test together — with the machine identity:

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
): string {
  const symptomLine = `Symptom mapping: issue ${issue.id} reported "${issue.description.split("\n")[0].replace(/^#\s*/, "")}" — reproduced by \`${reproTestPath(issue)}\` failing exactly that way, now passing.`;
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

${symptomLine}

Independent verification in a fresh sandbox: reproduction test passed; full-suite diff versus
the onboarding baseline shows no new failures${verification.newFailures.length > 0 ? ` (except: ${verification.newFailures.join(", ")})` : ""}.

A human reviews and merges this — please judge whether the reproduced symptom matches the report.`;
}

export async function runSingleIssue(input: SingleIssueInput, deps: LoopDeps): Promise<LoopOutcome> {
  const branch = fixBranch(input.issue);
  const prompt = buildFixPrompt(input.issue, input.profile);

  // FR-003: everything we emit is checked before it leaves the harness.
  assertNoSecrets([prompt], deps.env);

  const fix = await deps.runFixRun({
    cwd: input.repoDir,
    prompt,
    imageName: input.imageName,
    agent: input.agent,
    branch,
    name: input.issue.id,
  });

  if (fix.commits.length === 0) {
    return { branch, failure: "Fix run produced no commits — nothing to verify or PR." };
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
    const reproCmd = input.profile.singleTestCmd.replace("{test}", reproTestPath(input.issue));
    const repro = await sandbox.exec(reproCmd);
    const suite = await sandbox.exec(input.profile.testCmd);
    const verification = diffVerification({
      baselineFailures: input.profile.baselineFailures,
      postFixFailures: parsePytestFailures(suite.stdout),
      reproTestPassed: repro.exitCode === 0,
    });
    if (!verification.passed) {
      const reason = verification.newFailures.length > 0
        ? `new failures vs baseline: ${verification.newFailures.join(", ")}`
        : "reproduction test did not pass in the fresh sandbox";
      return { branch, failure: `Verification failed — ${reason}.`, newFailures: verification.newFailures };
    }

    const title = `[loop] fix ${input.issue.id}: ${input.issue.description.split("\n")[0].replace(/^#\s*/, "")}`;
    const body = buildPrBody(input.issue, redEvidence, greenEvidence, verification);
    assertNoSecrets([title, body], deps.env);

    const pr = await deps.createPr({ repoDir: input.repoDir, title, body, base: "main", head: branch });
    return { branch, prUrl: pr.url };
  } finally {
    await sandbox.close();
  }
}

// ---------------------------------------------------------------------------
// CLI entry: npm run loop -- --repo <dir-or-owner/name> --issue <n> --provider <name>
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

  const repoArg = flag("repo");
  const issueNumber = Number(flag("issue"));
  const providerName = flag("provider");
  const imageName = args.includes("--image") ? flag("image") : "sandcastle-loop";

  const env = loadEnv(process.cwd());
  const agent = resolveProvider(providerName, env);
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

  // The issue, normalized from GitHub.
  const raw = JSON.parse(
    execFileSync("gh", ["issue", "view", String(issueNumber), "--repo", ghRepo, "--json", "number,title,body,url"], {
      encoding: "utf8",
    }),
  ) as GitHubIssueInput;
  const issue = normalizeGitHubIssue(raw);

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

  const outcome = await runSingleIssue({ issue, repoDir, imageName, agent, profile }, deps);
  if (outcome.prUrl) {
    console.log(`PR opened: ${outcome.prUrl}`);
  } else {
    console.error(`Loop finished without a PR — ${outcome.failure}`);
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]).endsWith("src/loop.ts");
if (isDirectRun) {
  await main();
}
