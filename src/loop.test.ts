import { mkdtemp } from "node:fs/promises";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { assertNoSecrets } from "./assert-no-secrets.js";
import { PlainListParseError, SpecDocParseError } from "./issues.js";
import {
  LOOP_IDENTITY,
  QueueAbortedError,
  SourceSelectionError,
  buildFixPrompt,
  buildPrBody,
  fixBranch,
  formatSummary,
  parseCap,
  parseSourceArgs,
  reproTestPath,
  runOverrideIssue,
  runQueue,
  runSingleIssue,
  type ProjectProfile,
} from "./loop.js";
import type { AgentSpec, FixRunOutcome, FixSandboxHandle } from "./sandcastle-adapter.js";
import type { NormalizedIssue } from "./issues.js";

const agent: AgentSpec = { engine: "claude-code", model: "claude-haiku-4-5-20251001" };

const profile: ProjectProfile = {
  language: "python",
  installCmd: 'pip install -e ".[test]"',
  testCmd: "pytest -q",
  singleTestCmd: "pytest -q {test}",
  baselineFailures: [
    "tests/test_textops.py::TestSlugify::test_basic_phrase",
    "tests/test_textops.py::TestTitlecase::test_capitalizes_each_word",
    "tests/test_dates.py::TestParseIso8601::test_utc_timestamp_with_z",
  ],
  expectedDurationSec: 2,
};

const issue: NormalizedIssue = {
  id: "gh-1",
  description: "# slugify: generated slug is missing its first character\n\nslugify(\"Hello, World!\") gives \"ello-world\" instead of \"hello-world\".",
  sourceType: "github-issue",
  url: "https://github.com/manjula25/loop-fixtures-py/issues/1",
};

const RED = `============================= test session starts ==============================
FAILED tests/test_fixed.py::test_gh_1 - AssertionError: assert 'ello-world' == 'hello-world'
1 failed in 0.01s`;
const GREEN = `tests/fixed-issues/test_gh_1.py . [100%]\n1 passed in 0.01s`;
/** Clean-checkout suite: exactly the recorded baseline failures (3 seeded bugs). */
const BASELINE_SUITE = `FAILED tests/test_textops.py::TestSlugify::test_basic_phrase - AssertionError
FAILED tests/test_textops.py::TestTitlecase::test_capitalizes_each_word - AssertionError
FAILED tests/test_dates.py::TestParseIso8601::test_utc_timestamp_with_z - ValueError
3 failed, 3 passed in 0.8s`;
const SUITE_AFTER_FIX = `FAILED tests/test_textops.py::TestTitlecase::test_capitalizes_each_word - AssertionError
FAILED tests/test_dates.py::TestParseIso8601::test_utc_timestamp_with_z - ValueError
2 failed, 5 passed in 0.8s`; // only baseline failures remain

function agentStdout(): string {
  return `work work work
<red-evidence>
${RED}
</red-evidence>
<green-evidence>
${GREEN}
</green-evidence>`;
}

function fixOutcome(): FixRunOutcome {
  return { stdout: agentStdout(), commits: [{ sha: "abc123" }], branch: "fix/gh-1" };
}

function sandboxHandle(suiteOutput: string, reproExit = 0, installExit = 0): FixSandboxHandle & { commands: string[] } {
  const commands: string[] = [];
  return {
    branch: "fix/gh-1",
    worktreePath: "/tmp/wt",
    commands,
    async exec(command: string) {
      commands.push(command);
      if (command === profile.installCmd) {
        return { exitCode: installExit, stdout: "", stderr: installExit === 0 ? "" : "pip: build failed" };
      }
      if (command.includes(reproTestPath(issue))) {
        return { exitCode: reproExit, stdout: reproExit === 0 ? GREEN : RED, stderr: "" };
      }
      return { exitCode: 1, stdout: suiteOutput, stderr: "" };
    },
    async close() {
      return {};
    },
  };
}

interface DepOverrides {
  fixOutcome?: FixRunOutcome;
  /** Verification (second) sandbox; the preflight sandbox defaults to a matching baseline. */
  sandbox?: FixSandboxHandle;
  /** Preflight (first) sandbox — override to simulate a stale baseline. */
  preflight?: FixSandboxHandle;
  env?: Record<string, string>;
  /** Override to simulate a committed `.loop-harness` on the base branch. */
  pathCommittedOnBranch?: (repoDir: string, branch: string, path: string) => Promise<boolean>;
  /** mergePr result (opted-in runs); defaults to a fixed merge commit. */
  mergeCommit?: string;
  /** Simulated merge failure (conflict / API error) on opted-in runs. */
  mergeThrows?: string;
}

function makeDeps(overrides: DepOverrides = {}) {
  const env = overrides.env ?? {};
  let sandboxCalls = 0;
  return {
    env,
    runFixRun: vi.fn(async (_input: { branch: string; prompt: string }) => overrides.fixOutcome ?? fixOutcome()),
    createFixSandbox: vi.fn(async () => {
      sandboxCalls += 1;
      return sandboxCalls === 1
        ? (overrides.preflight ?? sandboxHandle(BASELINE_SUITE))
        : (overrides.sandbox ?? sandboxHandle(SUITE_AFTER_FIX));
    }),
    deleteBranch: vi.fn(async (_repoDir: string, _branch: string) => {}),
    createPr: vi.fn(async (args: { title: string; body: string }) => ({
      url: "https://github.com/manjula25/loop-fixtures-py/pull/9",
      ...args,
    })),
    mergePr: vi.fn(async () => {
      if (overrides.mergeThrows !== undefined) {
        throw new Error(overrides.mergeThrows);
      }
      return { mergeCommit: overrides.mergeCommit ?? "m0ckmerge" };
    }),
    pathCommittedOnBranch: overrides.pathCommittedOnBranch ?? (async () => false),
  };
}

describe("buildFixPrompt (FR-005, FR-103)", () => {
  it("contains the issue symptom, pinned commands, identity, and evidence format", () => {
    const prompt = buildFixPrompt(issue, profile);
    expect(prompt).toContain("ello-world"); // symptom from the issue
    expect(prompt).toContain('pip install -e ".[test]"');
    expect(prompt).toContain("pytest -q");
    expect(prompt).toContain(reproTestPath(issue));
    expect(prompt).toContain(LOOP_IDENTITY.name);
    expect(prompt).toContain(LOOP_IDENTITY.email);
    expect(prompt).toContain("<red-evidence>");
    expect(prompt).toContain("<green-evidence>");
  });

  it("with staged attachments, instructs the agent to commit only the fix and test — never anything under .loop-harness/", () => {
    const prompt = buildFixPrompt(issue, profile, {
      staged: [
        {
          url: "https://github.com/user-attachments/assets/aaaa",
          stagedPath: ".loop-harness/attachments/gh-1/aaaa",
          excerpt: "log line 1",
        },
      ],
      failedUrls: [],
    });
    expect(prompt).toMatch(/commit only the fix and the reproduction test/i);
    expect(prompt).toContain("`.loop-harness/`");
  });
});

describe("runSingleIssue", () => {
  it("opens a PR with verbatim RED/GREEN evidence and symptom mapping on gate pass", async () => {
    const deps = makeDeps();
    const outcome = await runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps);
    expect(outcome.prUrl).toContain("/pull/");
    expect(deps.createPr).toHaveBeenCalledTimes(1);
    const body = deps.createPr.mock.calls[0][0].body as string;
    expect(body).toContain(RED); // verbatim, not paraphrased
    expect(body).toContain(GREEN);
    expect(body).toMatch(/symptom mapping/i);
    expect(body).toContain(issue.id);
    // no closing keywords before issue numbers (issue-tracker doc rule)
    expect(body).not.toMatch(/(close[sd]?|fix(es|ed)?|resolve[sd]?)\s+#?\d/i);
    // success: only the preflight branch is cleaned up, never the PR's fix branch
    expect(deps.deleteBranch).toHaveBeenCalledTimes(1);
    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "loop/preflight-gh-1");
  });

  it("aborts before the fix run when the onboarding baseline no longer matches a fresh run (stale profile)", async () => {
    // SUITE_AFTER_FIX lacks one baseline failure → the recorded profile is stale
    const deps = makeDeps({ preflight: sandboxHandle(SUITE_AFTER_FIX) });
    const outcome = await runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps);
    expect(deps.runFixRun).not.toHaveBeenCalled(); // no agent spend on a stale profile
    expect(deps.createPr).not.toHaveBeenCalled();
    expect(outcome.failure).toMatch(/stale|re-?onboard/i);
    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "loop/preflight-gh-1");
  });

  it("aborts before the fix run when the preflight suite output is unreadable", async () => {
    const deps = makeDeps({ preflight: sandboxHandle("") });
    const outcome = await runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps);
    expect(deps.runFixRun).not.toHaveBeenCalled();
    expect(deps.createPr).not.toHaveBeenCalled();
    expect(outcome.failure).toMatch(/unreadable|summary/i);
  });

  it("records failure and opens no PR when verification fails (new failure vs baseline), and cleans up the fix branch", async () => {
    const suiteWithNewFailure = SUITE_AFTER_FIX.replace(
      "2 failed, 5 passed",
      "FAILED tests/test_textops.py::TestWordCount::test_counts_words - AssertionError\n3 failed, 4 passed",
    );
    const deps = makeDeps({ sandbox: sandboxHandle(suiteWithNewFailure) });
    const outcome = await runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps);
    expect(outcome.prUrl).toBeUndefined();
    expect(deps.createPr).not.toHaveBeenCalled();
    expect(outcome.failure).toBeTruthy();
    expect(outcome.newFailures).toContain("tests/test_textops.py::TestWordCount::test_counts_words");
    // the failed run's fix branch is deleted so a re-run starts clean
    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "fix/gh-1");
  });

  it("records failure and opens no PR when the reproduction test does not pass in the fresh sandbox", async () => {
    const deps = makeDeps({ sandbox: sandboxHandle(SUITE_AFTER_FIX, /* reproExit */ 1) });
    const outcome = await runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps);
    expect(deps.createPr).not.toHaveBeenCalled();
    expect(outcome.failure).toBeTruthy();
    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "fix/gh-1");
  });

  it("refuses the gate when the verification suite output is unreadable (no summary line)", async () => {
    const deps = makeDeps({ sandbox: sandboxHandle("") });
    const outcome = await runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps);
    expect(deps.createPr).not.toHaveBeenCalled();
    expect(outcome.failure).toMatch(/unreadable|summary/i);
    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "fix/gh-1");
  });

  it("reads a skipped-only verification suite — any counted outcome is execution evidence (WI-4 T3)", async () => {
    // A suite reporting only "4 skipped" carries a counted outcome: the gate
    // must treat it as readable (no failure lines → no new failures), not
    // reject it as unreadable the way silence is rejected.
    const deps = makeDeps({ sandbox: sandboxHandle("4 skipped in 0.01s") });
    const outcome = await runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps);
    expect(outcome.failure).toBeUndefined();
    expect(outcome.prUrl).toContain("/pull/");
  });

  it("installs the project in every fresh sandbox before running any test", async () => {
    const deps = makeDeps();
    const results = deps.createFixSandbox.mock.results as unknown as { value: Promise<FixSandboxHandle & { commands: string[] }> }[];
    await runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps);
    const handles = await Promise.all(results.map((r) => r.value));
    expect(handles[0]!.commands[0]).toBe(profile.installCmd); // preflight
    expect(handles[1]!.commands[0]).toBe(profile.installCmd); // verification
    expect(deps.createPr).toHaveBeenCalledTimes(1);
  });

  it("records failure and opens no PR when the install command fails in the fresh sandbox", async () => {
    const deps = makeDeps({ sandbox: sandboxHandle(SUITE_AFTER_FIX, /* reproExit */ 0, /* installExit */ 1) });
    const outcome = await runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps);
    expect(deps.createPr).not.toHaveBeenCalled();
    expect(outcome.failure).toContain("install");
    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "fix/gh-1");
  });

  it("cleans up the fix branch when the fix run produces no commits", async () => {
    const deps = makeDeps({ fixOutcome: { stdout: "did nothing", commits: [], branch: "fix/gh-1" } });
    const outcome = await runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps);
    expect(outcome.prUrl).toBeUndefined();
    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "fix/gh-1");
  });

  it("blocks emission when any emitted string would leak an env value (FR-003)", async () => {
    const deps = makeDeps({
      env: { CLI_PROXY_API_URL: "http://sentinel-proxy-8317.local" },
      fixOutcome: {
        ...fixOutcome(),
        // leak INSIDE the red-evidence block — that text lands in the PR body
        stdout: agentStdout().replace(RED, `${RED}\nproxy: http://sentinel-proxy-8317.local`),
      },
    });
    await expect(
      runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps),
    ).rejects.toThrow(/Secret leak blocked/);
    expect(deps.createPr).not.toHaveBeenCalled();
  });

  it("instructs the agent to commit with the loop identity and targets fix/<issue-id>", async () => {
    const deps = makeDeps();
    await runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, deps);
    const fixInput = deps.runFixRun.mock.calls[0]![0] as { branch: string; prompt: string };
    expect(fixInput.branch).toBe("fix/gh-1");
    expect(fixInput.prompt).toContain(`git config user.name ${LOOP_IDENTITY.name}`);
    expect(fixInput.prompt).toContain(`git config user.email ${LOOP_IDENTITY.email}`);
  });
});

describe("runSingleIssue auto-merge (WI-6 T3, FR-003/FR-004 wiring)", () => {
  const optedIn: ProjectProfile = { ...profile, autoMerge: true };
  const run = (deps: ReturnType<typeof makeDeps>, p: ProjectProfile) =>
    runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile: p }, deps);

  it("opted-in + verification green: mergePr called exactly once with the created PR url; outcome carries merged", async () => {
    const deps = makeDeps({ mergeCommit: "deadbeef" });
    const outcome = await run(deps, optedIn);
    expect(deps.mergePr).toHaveBeenCalledTimes(1);
    expect(deps.mergePr).toHaveBeenCalledWith({
      repoDir: "/tmp/repo",
      prUrl: "https://github.com/manjula25/loop-fixtures-py/pull/9",
    });
    expect(outcome.merged).toEqual({
      prUrl: "https://github.com/manjula25/loop-fixtures-py/pull/9",
      mergeCommit: "deadbeef",
    });
    // FR-003 at the same seam: the opted-in PR body states the machine gate
    // chain, never the human-review sentence.
    const body = deps.createPr.mock.calls[0]![0] as { body: string };
    expect(body.body).toContain("canary");
    expect(body.body).not.toContain("A human reviews and merges this");
  });

  it("opted-out (no autoMerge in profile): mergePr NEVER called; outcome shape identical to today's", async () => {
    const deps = makeDeps();
    const outcome = await run(deps, profile);
    expect(deps.mergePr).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      branch: "fix/gh-1",
      prUrl: "https://github.com/manjula25/loop-fixtures-py/pull/9",
    });
    // and the body keeps today's human-review closing (pinned in buildPrBody tests)
    const body = deps.createPr.mock.calls[0]![0] as { body: string };
    expect(body.body).toContain("A human reviews and merges this");
  });

  it("opted-in but mergePr throws (conflict/API error): no merged, a loud mergeFailure, the run does not throw, PR still returned", async () => {
    const deps = makeDeps({ mergeThrows: "gh: merge conflict — base branch moved" });
    const outcome = await run(deps, optedIn); // resolves — a merge failure never throws
    expect(deps.mergePr).toHaveBeenCalledTimes(1);
    expect(outcome.merged).toBeUndefined();
    expect(outcome.mergeFailure).toContain("merge conflict");
    expect(outcome.prUrl).toBe("https://github.com/manjula25/loop-fixtures-py/pull/9");
  });
});

describe("buildPrBody", () => {
  it("produces a body that itself passes the secrets guard", () => {
    const body = buildPrBody(issue, RED, GREEN, { passed: true, newFailures: [] }, undefined, false);
    expect(() => assertNoSecrets([body], { CLI_PROXY_API_URL: "http://x.local:1" })).not.toThrow();
  });

  it("autoMerge=true: states the machine gate chain (canary) and never the human-review sentence (WI-6 T3, FR-003)", () => {
    const body = buildPrBody(issue, RED, GREEN, { passed: true, newFailures: [] }, undefined, true);
    expect(body).toContain("canary");
    expect(body).not.toContain("A human reviews and merges this");
  });

  it("autoMerge=false: ends with exactly today's human-review sentence (FR-003: byte-identical default)", () => {
    const body = buildPrBody(issue, RED, GREEN, { passed: true, newFailures: [] }, undefined, false);
    expect(
      body.endsWith(
        "A human reviews and merges this — please judge whether the reproduced symptom matches the report.",
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WI-2 T4: queue mode — sequential runner, cap/triage wiring, summary, override.
// ---------------------------------------------------------------------------

function queueIssue(n: number): NormalizedIssue {
  return { id: `gh-${n}`, description: `# queue issue ${n}`, sourceType: "github-issue" };
}

/** Issue-parameterized sandbox: same shape as sandboxHandle, per-issue repro paths. */
function issueSandbox(
  target: NormalizedIssue,
  suite: string,
  reproExit = 0,
): FixSandboxHandle {
  return {
    branch: fixBranch(target),
    worktreePath: "/tmp/wt",
    async exec(command: string) {
      if (command === profile.installCmd) {
        return { exitCode: 0, stdout: "", stderr: "" };
      }
      if (command.includes(reproTestPath(target))) {
        return { exitCode: reproExit, stdout: reproExit === 0 ? GREEN : RED, stderr: "" };
      }
      return { exitCode: 1, stdout: suite, stderr: "" };
    },
    async close() {
      return {};
    },
  };
}

interface QueueDepsConfig {
  issues?: NormalizedIssue[];
  prs?: { headRefName: string; body: string }[];
  mergedPrs?: { number: number; url: string; headRefName: string; body: string }[];
  /** Id whose verification sandbox fails the reproduction test (issue-level failure). */
  failReproFor?: string;
  /** Preflight reports a stale baseline for every issue (harness-level abort). */
  staleBaseline?: boolean;
  /** Preflight reports a stale baseline for this id only — aborts mid-queue. */
  staleBaselineFor?: string;
  triageStdout?: string;
  /** The triage run itself throws (sandbox/credentials failure), not its output. */
  triageThrows?: string;
  /** `.loop-harness` is committed on main — attachment delivery must abort (harness-level). */
  pathCommittedOnBranch?: boolean;
  /** Opted-in runs: merge fails (conflict/API error) for PRs whose url contains this token. */
  mergeThrowsFor?: string;
}

function makeQueueDeps(config: QueueDepsConfig = {}) {
  const issues = config.issues ?? [issue];
  let active: NormalizedIssue = issues[0]!;
  let openNow = 0;
  let maxOpen = 0;
  const track = (handle: FixSandboxHandle): FixSandboxHandle => ({
    ...handle,
    async close() {
      openNow -= 1;
      return handle.close();
    },
  });

  const deps = {
    env: {} as Record<string, string>,
    runFixRun: vi.fn(async (input: { branch: string; name?: string }) => {
      active = issues.find((i) => fixBranch(i) === input.branch) ?? issues[0]!;
      return { stdout: agentStdout(), commits: [{ sha: "abc" }], branch: input.branch };
    }),
    createFixSandbox: vi.fn(async (input: { branch: string; baseBranch?: string }) => {
      openNow += 1;
      maxOpen = Math.max(maxOpen, openNow);
      // Both `fix/<id>` and `loop/preflight-<id>` end in the id, so the
      // preflight sandbox resolves to its own issue rather than the previous
      // one — `runFixRun` has not been reached yet when preflight runs.
      active = issues.find((i) => input.branch.endsWith(i.id)) ?? active;
      if (input.baseBranch === "main") {
        // baseline preflight
        const stale = config.staleBaseline === true || config.staleBaselineFor === active.id;
        return track(issueSandbox(active, stale ? SUITE_AFTER_FIX : BASELINE_SUITE));
      }
      const fails = config.failReproFor === active.id;
      return track(issueSandbox(active, SUITE_AFTER_FIX, fails ? 1 : 0));
    }),
    deleteBranch: vi.fn(async (_repoDir: string, _branch: string) => {}),
    createPr: vi.fn(async (args: { head: string }) => ({ url: `https://example/pr/${args.head}` })),
    mergePr: vi.fn(async (input: { prUrl: string }) => {
      if (config.mergeThrowsFor !== undefined && input.prUrl.includes(config.mergeThrowsFor)) {
        throw new Error("gh: merge conflict — base branch moved");
      }
      return { mergeCommit: "mdef456" };
    }),
    // QueueDeps
    ghJson: vi.fn((_args: string[], _cwd: string) =>
      JSON.stringify(issues.map((i) => ({ number: Number(i.id.slice(3)), title: i.description, body: null })))),
    listOpenPrs: vi.fn(async () => config.prs ?? []),
    listMergedPrs: vi.fn(async () => config.mergedPrs ?? []),
    listFixBranches: vi.fn(async () => []),
    deleteRemoteBranch: vi.fn(async () => {}),
    runTriage: vi.fn(async () => {
      if (config.triageThrows !== undefined) {
        throw new Error(config.triageThrows);
      }
      return config.triageStdout ?? "";
    }),
    pathCommittedOnBranch: vi.fn(async () => config.pathCommittedOnBranch === true),
  };
  return { deps, maxOpen: () => maxOpen };
}

const queueRunInput = (over: Partial<Parameters<typeof runQueue>[0]> = {}) => ({
  ghRepo: "owner/name",
  repoDir: "/tmp/repo",
  imageName: "sandcastle-loop",
  agent,
  profile,
  cap: 3,
  triage: false,
  ...over,
});

describe("runQueue (WI-2 T4)", () => {
  it("runs issues sequentially; an issue-level failure continues the queue; summary is honest", async () => {
    const { deps, maxOpen } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2), queueIssue(3)],
      failReproFor: "gh-2",
    });

    const summary = await runQueue(queueRunInput(), deps);

    expect(summary.attempted).toEqual(["gh-1", "gh-2", "gh-3"]);
    expect(summary.fixed).toEqual(["gh-1", "gh-3"]);
    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0]![0]).toBe("gh-2");
    expect(summary.failed[0]![1]).toContain("Verification failed");
    expect(summary.skippedDuplicate).toEqual([]);
    expect(summary.notAdmitted).toEqual([]);
    expect(summary.prUrls).toEqual([
      "https://example/pr/fix/gh-1",
      "https://example/pr/fix/gh-3",
    ]);
    expect(deps.createPr).toHaveBeenCalledTimes(2);
    // the failed issue's branch was cleaned up
    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "fix/gh-2");
    // strictly one sandbox at a time
    expect(maxOpen()).toBe(1);
  });

  it("skips a merged-covered issue as done and carries it into the summary counts line (WI-6 T2)", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2)],
      mergedPrs: [
        { number: 4, url: "https://example/pr/4", headRefName: "fix/gh-1", body: "" },
      ],
    });

    const summary = await runQueue(queueRunInput(), deps);

    expect(summary.skippedMerged).toEqual(["gh-1"]);
    expect(summary.attempted).toEqual(["gh-2"]);
    expect(summary.skippedDuplicate).toEqual([]);
    const counts = formatSummary(summary).split("\n")[0]!;
    expect(counts).toContain("| skipped-duplicate: 0");
    expect(counts).toContain("| skipped-merged: 1");
  });

  it("opted-in queue: merged outcomes land in mergedPrs; a merge failure still counts as fixed and is surfaced loudly (WI-6 T3)", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2)],
      mergeThrowsFor: "fix/gh-2",
    });
    const optedIn: ProjectProfile = { ...profile, autoMerge: true };

    const summary = await runQueue(queueRunInput({ profile: optedIn }), deps);

    expect(summary.mergedPrs).toEqual([["gh-1", "https://example/pr/fix/gh-1", "mdef456"]]);
    // Deliberate choice (WI-6 T3): a merge failure is NOT an issue failure — the
    // fix is verified and the PR is real work, so it stays `fixed`, and the
    // failure gets its own loud summary surface instead of the FAILED line.
    expect(summary.fixed).toEqual(["gh-1", "gh-2"]);
    expect(summary.failed).toEqual([]);
    expect(summary.mergeFailures).toHaveLength(1);
    expect(summary.mergeFailures[0]![0]).toBe("gh-2");
    expect(summary.mergeFailures[0]![1]).toContain("merge conflict");

    const lines = formatSummary(summary).split("\n");
    const prAt = lines.findIndex((l) => l.startsWith("PR: "));
    const mergedAt = lines.findIndex((l) => l === "MERGED gh-1: https://example/pr/fix/gh-1 @ mdef456");
    const failedAt = lines.findIndex((l) => l.startsWith("MERGE FAILED gh-2:"));
    expect(prAt).toBeGreaterThanOrEqual(0);
    expect(mergedAt).toBeGreaterThan(prAt); // MERGED lines come after the PR: lines
    expect(failedAt).toBeGreaterThan(mergedAt);
    expect(lines[failedAt]).toContain("merge conflict");
  });

  it("aborts the whole queue on a harness-level failure (stale baseline), attempting nothing further", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2)],
      staleBaseline: true,
    });

    await expect(runQueue(queueRunInput(), deps)).rejects.toThrow(/queue aborted/i);
    expect(deps.runFixRun).not.toHaveBeenCalled();
    expect(deps.createPr).not.toHaveBeenCalled();
  });

  it("an abort mid-queue still carries the PR the run already earned", async () => {
    // gh-1 fixes and opens a PR; gh-2 trips the stale-baseline preflight. That
    // PR is real, human-reviewable work — the abort must not swallow it.
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2), queueIssue(3)],
      staleBaselineFor: "gh-2",
    });

    const error = await runQueue(queueRunInput(), deps).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(QueueAbortedError);
    const aborted = error as QueueAbortedError;
    expect(aborted.message).toMatch(/gh-2/);
    expect(aborted.summary.prUrls).toEqual(["https://example/pr/fix/gh-1"]);
    expect(aborted.summary.fixed).toEqual(["gh-1"]);
    // attempted stays the honest total, and every attempt is accounted for
    expect(aborted.summary.attempted).toEqual(["gh-1", "gh-2"]);
    expect(aborted.summary.failed.map(([id]) => id)).toEqual(["gh-2"]);
    // gh-3 was admitted but never reached — no third sandbox was opened
    expect(deps.createPr).toHaveBeenCalledTimes(1);
    // and that partial summary is printable, PR line included
    expect(formatSummary(aborted.summary)).toContain("PR: https://example/pr/fix/gh-1");
  });

  it("admits the first cap issues deterministically without triage, never calling the model", async () => {
    const { deps } = makeQueueDeps({
      issues: [1, 2, 3, 4, 5].map(queueIssue),
    });

    const summary = await runQueue(queueRunInput({ cap: 2 }), deps);

    expect(summary.attempted).toEqual(["gh-1", "gh-2"]);
    expect(summary.notAdmitted).toEqual([
      ["gh-3", "cap"],
      ["gh-4", "cap"],
      ["gh-5", "cap"],
    ]);
    expect(deps.runTriage).not.toHaveBeenCalled();
  });

  it("defers a file-overlapping issue below the cap — the flag, not the cap, is the opt-in", async () => {
    // cap 3, two eligible issues: the cap forces no choice, but both fixes
    // touch src/api.py, so admitting each would produce conflicting PRs.
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2)],
      triageStdout:
        '<triage>{"scores":{"gh-1":3,"gh-2":3},"files":{"gh-1":["src/api.py"],"gh-2":["src/api.py"]}}</triage>',
    });

    const summary = await runQueue(queueRunInput({ cap: 3, triage: true }), deps);

    expect(deps.runTriage).toHaveBeenCalledTimes(1);
    expect(summary.attempted).toEqual(["gh-1"]);
    expect(summary.notAdmitted).toEqual([["gh-2", "file overlap with gh-1"]]);
    expect(deps.createPr).toHaveBeenCalledTimes(1);
  });

  it("buys no model call for a single eligible issue — it can outrank and overlap nobody", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1)],
      triageStdout: '<triage>{"scores":{"gh-1":5},"files":{}}</triage>',
    });

    const summary = await runQueue(queueRunInput({ cap: 3, triage: true }), deps);

    expect(deps.runTriage).not.toHaveBeenCalled();
    expect(summary.attempted).toEqual(["gh-1"]);
  });

  it("never calls the model when --triage is absent, however large the queue", async () => {
    const { deps } = makeQueueDeps({ issues: [1, 2, 3, 4].map(queueIssue) });

    await runQueue(queueRunInput({ cap: 2, triage: false }), deps);

    expect(deps.runTriage).not.toHaveBeenCalled();
  });

  it("with --triage over cap: ranks by score, defers file-overlapping issues, deletes loop/triage", async () => {
    const { deps } = makeQueueDeps({
      issues: [1, 2, 3, 4, 5].map(queueIssue),
      triageStdout:
        '<triage>{"scores":{"gh-1":1,"gh-2":1,"gh-3":1,"gh-4":4,"gh-5":5},"files":{"gh-4":["src/a.py"],"gh-5":["src/a.py"]}}</triage>',
    });

    const summary = await runQueue(queueRunInput({ cap: 2, triage: true }), deps);

    expect(deps.runTriage).toHaveBeenCalledTimes(1);
    // ranked: gh-5, gh-4 (deferred — overlaps gh-5 on src/a.py), gh-1, gh-2, gh-3
    expect(summary.attempted).toEqual(["gh-5", "gh-1"]);
    expect(summary.notAdmitted).toContainEqual(["gh-4", "file overlap with gh-5"]);
    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "loop/triage");
  });

  it("degrades loudly to deterministic order when triage output is unusable", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { deps } = makeQueueDeps({
        issues: [1, 2, 3, 4, 5].map(queueIssue),
        triageStdout: "the model refused to answer",
      });

      const summary = await runQueue(queueRunInput({ cap: 2, triage: true }), deps);

      expect(summary.attempted).toEqual(["gh-1", "gh-2"]);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/falling back to deterministic order/i));
    } finally {
      warn.mockRestore();
    }
  });

  it("degrades — and still cleans loop/triage — when the triage run itself throws", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { deps } = makeQueueDeps({
        issues: [1, 2, 3, 4, 5].map(queueIssue),
        triageThrows: "docker: no such image",
      });

      const summary = await runQueue(queueRunInput({ cap: 2, triage: true }), deps);

      // the queue keeps its issues: a failed optimization is not a failed run
      expect(summary.attempted).toEqual(["gh-1", "gh-2"]);
      expect(summary.fixed).toEqual(["gh-1", "gh-2"]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("docker: no such image"));
      expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "loop/triage");
    } finally {
      warn.mockRestore();
    }
  });

  it("blocks the degrade warning when the triage failure would leak an env value", async () => {
    const { deps } = makeQueueDeps({
      issues: [1, 2, 3].map(queueIssue),
      triageThrows: "auth rejected token sk-live-secret",
    });
    deps.env.ANTHROPIC_API_KEY = "sk-live-secret";

    await expect(runQueue(queueRunInput({ cap: 2, triage: true }), deps)).rejects.toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });
});

describe("runOverrideIssue (--issue N single-issue mode, WI-2 T4)", () => {
  it("skips the issue when an open PR already covers it — no agent spend", async () => {
    const { deps } = makeQueueDeps({
      prs: [{ headRefName: "fix/gh-1", body: "" }],
    });

    const result = await runOverrideIssue(
      { issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile },
      deps,
    );

    expect(result).toEqual({ kind: "skipped-duplicate", id: "gh-1" });
    expect(deps.runFixRun).not.toHaveBeenCalled();
  });

  it("skips the issue as done when a merged PR already covers it — no agent spend (WI-6 T2)", async () => {
    const { deps } = makeQueueDeps({
      mergedPrs: [{ number: 4, url: "https://example/pr/4", headRefName: "fix/gh-1", body: "" }],
    });

    const result = await runOverrideIssue(
      { issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile },
      deps,
    );

    expect(result).toEqual({ kind: "skipped-merged", id: "gh-1" });
    expect(deps.runFixRun).not.toHaveBeenCalled();
  });

  it("runs the issue through the normal single-issue path when no PR covers it", async () => {
    const { deps } = makeQueueDeps();

    const result = await runOverrideIssue(
      { issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile },
      deps,
    );

    expect(result.kind).toBe("run");
    expect(result.kind === "run" && result.outcome.prUrl).toBe("https://example/pr/fix/gh-1");
  });
});

describe("parseCap (--max-issues validation, WI-2 T4)", () => {
  it("accepts an integer >= 1 and rejects everything else, naming the flag", () => {
    expect(parseCap("3")).toBe(3);
    expect(parseCap("1")).toBe(1);
    expect(() => parseCap("0")).toThrow(/--max-issues/);
    expect(() => parseCap("-2")).toThrow(/--max-issues/);
    expect(() => parseCap("many")).toThrow(/--max-issues/);
  });
});

// ---------------------------------------------------------------------------
// WI-3 T5: --spec-doc / --plain-list source selection (FR-007) — acquisition
// is replaced by a preset queue, and the summary names the source.
// ---------------------------------------------------------------------------

const specIssues: NormalizedIssue[] = [
  { id: "spec-camera-json", description: "# camera JSON", sourceType: "spec-doc" },
  { id: "spec-cache-flush", description: "# cache flush", sourceType: "spec-doc" },
];
const listIssues: NormalizedIssue[] = [
  { id: "list-stale-pin", description: "stale pin after restart", sourceType: "plain-list" },
];

describe("runQueue with a preset source (WI-3 T5, FR-007)", () => {
  it("replaces GitHub acquisition entirely — ghJson is never called — and the summary names a spec-doc source", async () => {
    const { deps } = makeQueueDeps({ issues: specIssues });

    const summary = await runQueue(
      queueRunInput({ sourceIssues: specIssues, sourceName: "spec-doc (docs/spec.md)" }),
      deps,
    );

    expect(deps.ghJson).not.toHaveBeenCalled();
    expect(summary.attempted).toEqual(["spec-camera-json", "spec-cache-flush"]);
    expect(summary.fixed).toEqual(["spec-camera-json", "spec-cache-flush"]);
    expect(formatSummary(summary)).toContain("source: spec-doc (docs/spec.md)");
  });

  it("labels a plain-list source run the same way", async () => {
    const { deps } = makeQueueDeps({ issues: listIssues });

    const summary = await runQueue(
      queueRunInput({ sourceIssues: listIssues, sourceName: "plain-list (issues.txt)" }),
      deps,
    );

    expect(deps.ghJson).not.toHaveBeenCalled();
    expect(summary.attempted).toEqual(["list-stale-pin"]);
    expect(formatSummary(summary)).toContain("source: plain-list (issues.txt)");
  });

  it("keeps the default GitHub path and summary shape when no source is given", async () => {
    const { deps } = makeQueueDeps({ issues: [queueIssue(1)] });

    const summary = await runQueue(queueRunInput(), deps);

    expect(deps.ghJson).toHaveBeenCalledTimes(1);
    expect(summary.source).toBeUndefined();
    const text = formatSummary(summary);
    expect(text.split("\n")[0]).toMatch(/^Run summary — /);
    expect(text).not.toContain("source:");
  });
});

describe("parseSourceArgs (--spec-doc / --plain-list selection, WI-3 T5)", () => {
  it("returns undefined when neither flag is given — the GitHub default", () => {
    expect(parseSourceArgs(["--repo", "owner/name", "--provider", "claude-code"])).toBeUndefined();
  });

  it("reads and parses a --spec-doc file, naming the source for the summary", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loop-t5-spec-"));
    try {
      const path = join(dir, "spec.md");
      writeFileSync(path, "## Camera JSON\n\ncamera returns invalid json\n");

      expect(parseSourceArgs(["--spec-doc", path])).toEqual({
        issues: [
          expect.objectContaining({ id: "spec-camera-json", sourceType: "spec-doc" }),
        ],
        sourceName: `spec-doc (${path})`,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads and parses a --plain-list file, naming the source for the summary", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loop-t5-list-"));
    try {
      const path = join(dir, "issues.txt");
      writeFileSync(path, "stale pin after restart | logs/pin.log\n");

      expect(parseSourceArgs(["--plain-list", path])).toEqual({
        issues: [
          expect.objectContaining({
            id: "list-stale-pin-after-restart",
            sourceType: "plain-list",
            attachedLog: "logs/pin.log",
          }),
        ],
        sourceName: `plain-list (${path})`,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("both flags together → startup error: sources cannot be combined", () => {
    expect(() => parseSourceArgs(["--spec-doc", "a.md", "--plain-list", "b.txt"])).toThrow(
      /sources cannot be combined/,
    );
  });

  it("a flag with no path value is a startup error naming the flag", () => {
    expect(() => parseSourceArgs(["--spec-doc"])).toThrow(/--spec-doc/);
    expect(() => parseSourceArgs(["--plain-list", "--provider"])).toThrow(/--plain-list/);
  });

  it("`--issue` combined with a source flag is a startup error naming both flags", () => {
    const realistic = [
      "--repo",
      "owner/name",
      "--spec-doc",
      "a.md",
      "--issue",
      "3",
      "--provider",
      "claude-code",
    ];
    expect(() => parseSourceArgs(realistic)).toThrow(
      /--issue cannot be combined with --spec-doc\/--plain-list/,
    );
    const call = (): unknown => parseSourceArgs(["--plain-list", "b.txt", "--issue", "3"]);
    expect(call).toThrow(SourceSelectionError);
    expect(call).toThrow(/--issue cannot be combined/);
  });

  it("`--label` combined with a source flag is a startup error naming both flags", () => {
    const call = (): unknown =>
      parseSourceArgs(["--repo", "owner/name", "--label", "bug", "--plain-list", "b.txt"]);
    expect(call).toThrow(SourceSelectionError);
    expect(call).toThrow(/--label cannot be combined with --spec-doc\/--plain-list/);
    expect(() => parseSourceArgs(["--spec-doc", "a.md", "--label", "bug"])).toThrow(
      /--label cannot be combined/,
    );
  });

  it("an unreadable file → named error naming the path, thrown before any sandbox or worktree work", () => {
    const missing = join(tmpdir(), "loop-t5-no-such-source-file.md");
    const call = (): unknown => parseSourceArgs(["--spec-doc", missing]);
    expect(call).toThrow(SourceSelectionError);
    expect(call).toThrow(missing);
  });

  it("surfaces SpecDocParseError and PlainListParseError verbatim — not swallowed or re-wrapped", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loop-t5-parse-"));
    try {
      const specPath = join(dir, "no-headings.md");
      writeFileSync(specPath, "just prose, no section headings\n");
      expect(() => parseSourceArgs(["--spec-doc", specPath])).toThrow(SpecDocParseError);

      const listPath = join(dir, "comments-only.txt");
      writeFileSync(listPath, "# only a comment line\n");
      expect(() => parseSourceArgs(["--plain-list", listPath])).toThrow(PlainListParseError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// WI-3 T2: attachment fetch, sandbox delivery, loud degrade (FR-003/FR-004).
// LoopDeps gains no new member — fetching is intercepted via the global fetch.
// ---------------------------------------------------------------------------

const ATTACHMENT_URL = "https://github.com/user-attachments/assets/aaaa";
const ATTACHMENT_BODY = Array.from({ length: 5 }, (_, i) => `log line ${i + 1}`).join("\n");

describe("attachments in the loop (WI-3 T2)", () => {
  const issueWithAttachment: NormalizedIssue = {
    ...issue,
    description: `${issue.description}\n\nUploaded log: ${ATTACHMENT_URL}`,
  };
  const clearedProfile: ProjectProfile = { ...profile, confidentialityCleared: true };

  it("refuses an uncleared issue with an attachment before any sandbox or agent spend (FR-002)", async () => {
    const deps = makeDeps();
    const outcome = await runSingleIssue(
      { issue: issueWithAttachment, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile },
      deps,
    );

    expect(outcome.prUrl).toBeUndefined();
    expect(outcome.branch).toBe("fix/gh-1");
    expect(outcome.failure).toContain("clear the repo"); // the gate's own message
    expect(outcome.failureKind).toBeUndefined(); // issue-level: the queue continues
    expect(deps.createFixSandbox).not.toHaveBeenCalled(); // zero Docker spend
    expect(deps.runFixRun).not.toHaveBeenCalled(); // zero API spend
  });

  it("gate refusal is issue-level — the queue continues with issues that carry no attachments", async () => {
    const { deps } = makeQueueDeps({ issues: [issueWithAttachment, queueIssue(2)] });

    const summary = await runQueue(queueRunInput({ profile }), deps); // uncleared profile

    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0]![0]).toBe("gh-1");
    expect(summary.failed[0]![1]).toContain("clear the repo");
    expect(summary.fixed).toEqual(["gh-2"]); // the attachment-free issue still ran
  });

  it("delivers a cleared attachment into the sandbox and inlines the excerpt (FR-003)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(ATTACHMENT_BODY)));
    const repoDir = await mkdtemp(join(tmpdir(), "loop-t2-"));
    try {
      const deps = makeDeps();
      const outcome = await runSingleIssue(
        { issue: issueWithAttachment, repoDir, imageName: "sandcastle-loop", agent, profile: clearedProfile },
        deps,
      );

      // the run completed: the guarded prompt (excerpt included) passed assertNoSecrets
      expect(outcome.prUrl).toBeTruthy();
      const fixInput = deps.runFixRun.mock.calls[0]![0] as { prompt: string; copyToWorktree?: readonly string[] };
      // T2c: the single top-level directory, not per-file stagedPaths —
      // Sandcastle's copyToWorktree cp -R creates no dest parents.
      expect(fixInput.copyToWorktree).toEqual([".loop-harness"]);
      expect(fixInput.prompt).toContain("log line 1"); // excerpt head inlined
      expect(fixInput.prompt).toContain(".loop-harness/attachments/gh-1/aaaa"); // in-sandbox path
    } finally {
      vi.unstubAllGlobals();
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("stages one copyToWorktree entry even when multiple attachments stage (T2c)", async () => {
    const secondUrl = "https://github.com/user-attachments/assets/bbbb";
    const issueWithTwoAttachments: NormalizedIssue = {
      ...issue,
      description: `${issue.description}\n\nUploaded log: ${ATTACHMENT_URL}\nUploaded trace: ${secondUrl}`,
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(ATTACHMENT_BODY)));
    const repoDir = await mkdtemp(join(tmpdir(), "loop-t2c-"));
    try {
      const deps = makeDeps();
      const outcome = await runSingleIssue(
        { issue: issueWithTwoAttachments, repoDir, imageName: "sandcastle-loop", agent, profile: clearedProfile },
        deps,
      );

      expect(outcome.prUrl).toBeTruthy();
      const fixInput = deps.runFixRun.mock.calls[0]![0] as { copyToWorktree?: readonly string[] };
      // One directory entry covers every staged file — never one entry per file.
      expect(fixInput.copyToWorktree).toEqual([".loop-harness"]);
    } finally {
      vi.unstubAllGlobals();
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("degrades loudly on a failed fetch: the run proceeds and summary + PR body name the URL (FR-004)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 404 })));
    try {
      const { deps } = makeQueueDeps({ issues: [issueWithAttachment] });

      const summary = await runQueue(queueRunInput({ profile: clearedProfile }), deps);

      expect(summary.fixed).toEqual(["gh-1"]); // the issue still ran and fixed
      expect(formatSummary(summary)).toContain(`ATTACHMENT FAILED gh-1: ${ATTACHMENT_URL}`);
      const body = (deps.createPr.mock.calls[0]![0] as unknown as { body: string }).body;
      expect(body).toContain(`attachment fetch failed: ${ATTACHMENT_URL}`);
      const fixInput = deps.runFixRun.mock.calls[0]![0] as unknown as {
        prompt: string;
        copyToWorktree?: readonly string[];
      };
      expect(fixInput.prompt).toContain("expected but unavailable");
      expect(fixInput.prompt).toContain(ATTACHMENT_URL);
      expect(fixInput.copyToWorktree).toBeUndefined(); // nothing staged, nothing copied
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("aborts loudly with zero spend when main has .loop-harness committed (nesting guard)", async () => {
    const fetchMock = vi.fn(async () => new Response(ATTACHMENT_BODY));
    vi.stubGlobal("fetch", fetchMock);
    const repoDir = await mkdtemp(join(tmpdir(), "loop-nest-guard-"));
    try {
      const deps = makeDeps({ pathCommittedOnBranch: async () => true });

      const outcome = await runSingleIssue(
        { issue: issueWithAttachment, repoDir, imageName: "sandcastle-loop", agent, profile: clearedProfile },
        deps,
      );

      expect(outcome.prUrl).toBeUndefined();
      // names the root cause and the remediation
      expect(outcome.failure).toMatch(/committed|git rm/);
      expect(outcome.failure).toContain(".loop-harness");
      expect(outcome.failureKind).toBe("harness"); // repo-wide: the queue must abort too
      expect(fetchMock).not.toHaveBeenCalled(); // WI-4 T1: zero network side effect — the guard fires before the fetch
      expect(deps.createFixSandbox).not.toHaveBeenCalled(); // zero Docker spend
      expect(deps.runFixRun).not.toHaveBeenCalled(); // zero agent spend
      expect(deps.createPr).not.toHaveBeenCalled();
      // nothing staged: the refusal leaves no .loop-harness behind in the repo
      expect(existsSync(join(repoDir, ".loop-harness"))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("WI-4 T1: the guard gates on the discovered URL, not on staged output — even a fetch that would have failed never runs", async () => {
    // A doomed fetch (404) still proves the ordering: the refusal is decided
    // before any network leaves the harness, so nothing is fetched or staged.
    const fetchMock = vi.fn(async () => new Response("gone", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const repoDir = await mkdtemp(join(tmpdir(), "loop-nest-guard-prefetch-"));
    try {
      const deps = makeDeps({ pathCommittedOnBranch: async () => true });

      const outcome = await runSingleIssue(
        { issue: issueWithAttachment, repoDir, imageName: "sandcastle-loop", agent, profile: clearedProfile },
        deps,
      );

      expect(outcome.prUrl).toBeUndefined();
      expect(outcome.failure).toContain(".loop-harness");
      expect(outcome.failureKind).toBe("harness");
      expect(fetchMock).not.toHaveBeenCalled(); // no fetch before the guard
      expect(deps.createFixSandbox).not.toHaveBeenCalled();
      expect(deps.runFixRun).not.toHaveBeenCalled();
      expect(deps.createPr).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("WI-4 T1: no attachment URLs + committed .loop-harness — the guard is inert and the run proceeds exactly as today", async () => {
    const fetchMock = vi.fn(async () => new Response(ATTACHMENT_BODY));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const deps = makeDeps({ pathCommittedOnBranch: async () => true });

      const outcome = await runSingleIssue(
        { issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile: clearedProfile },
        deps,
      );

      // attachment-free issues are governed by the WI-1/WI-2 seam, not the guard
      expect(outcome.prUrl).toBeTruthy();
      expect(outcome.failure).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled(); // nothing to fetch
      expect(deps.createPr).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("a committed .loop-harness on main aborts the queue (harness-level) — attempted stays honest, nothing further runs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(ATTACHMENT_BODY)));
    try {
      const { deps } = makeQueueDeps({
        issues: [issueWithAttachment, queueIssue(2)],
        pathCommittedOnBranch: true,
      });

      const error = await runQueue(queueRunInput({ profile: clearedProfile }), deps).catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(QueueAbortedError);
      const aborted = error as QueueAbortedError;
      expect(aborted.message).toMatch(/committed/);
      expect(aborted.summary.attempted).toEqual(["gh-1"]); // honest: gh-1 was reached
      expect(aborted.summary.fixed).toEqual([]);
      expect(deps.runFixRun).not.toHaveBeenCalled();
      expect(deps.createPr).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ---------------------------------------------------------------------------
// WI-3 T7 (two-axis review fix): the plain-list normalizer moves the
// `| <value>` suffix out of the description into attachedLog — the discovery
// scan must include it, or the URL reaches the prompt ungated and unfetched.
// ---------------------------------------------------------------------------

const PLAIN_LIST_URL = "https://github.com/user-attachments/assets/cccc";
const PLAIN_LIST_BODY = Array.from({ length: 3 }, (_, i) => `pin log ${i + 1}`).join("\n");
const plainListAttachmentIssue: NormalizedIssue = {
  id: "list-login-fails",
  description: "login fails after restart", // no URL here — it lives in the suffix
  attachedLog: PLAIN_LIST_URL,
  sourceType: "plain-list",
};

describe("plain-list suffix attachments join discovery (WI-3 T7)", () => {
  it("gates an uncleared plain-list issue whose attachment URL lives in the `| <value>` suffix — zero spend, no PR", async () => {
    const deps = makeDeps();

    const outcome = await runSingleIssue(
      { issue: plainListAttachmentIssue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, // uncleared
      deps,
    );

    expect(outcome.prUrl).toBeUndefined();
    expect(outcome.failure).toContain("clear the repo");
    expect(outcome.failureKind).toBeUndefined(); // issue-level: the queue continues
    expect(deps.createFixSandbox).not.toHaveBeenCalled(); // zero Docker spend
    expect(deps.runFixRun).not.toHaveBeenCalled(); // zero API spend
    expect(deps.createPr).not.toHaveBeenCalled();
  });

  it("fetches and stages the suffix URL when cleared — excerpt in the prompt, staged path in the sandbox", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(PLAIN_LIST_BODY)));
    const repoDir = await mkdtemp(join(tmpdir(), "loop-t7-"));
    try {
      const deps = makeDeps({
        preflight: issueSandbox(plainListAttachmentIssue, BASELINE_SUITE),
        sandbox: issueSandbox(plainListAttachmentIssue, SUITE_AFTER_FIX),
      });

      const outcome = await runSingleIssue(
        { issue: plainListAttachmentIssue, repoDir, imageName: "sandcastle-loop", agent, profile: { ...profile, confidentialityCleared: true } },
        deps,
      );

      expect(outcome.prUrl).toBeTruthy();
      expect(fetch).toHaveBeenCalledWith(PLAIN_LIST_URL, expect.anything());
      const fixInput = deps.runFixRun.mock.calls[0]![0] as { prompt: string; copyToWorktree?: readonly string[] };
      expect(fixInput.prompt).toContain("pin log 1"); // excerpt inlined
      expect(fixInput.prompt).toContain(".loop-harness/attachments/list-login-fails/cccc");
      expect(fixInput.copyToWorktree).toEqual([".loop-harness"]);
    } finally {
      vi.unstubAllGlobals();
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  // PIN (expected green now): FR-001's scan for GitHub issues reads the
  // description only — attachedLog is an extracted copy of a fenced block that
  // the description already carries verbatim (this synthetic issue omits it
  // from the description, so nothing is discovered).
  it("PIN: a GitHub attachedLog (fenced log content) carrying a URL is still not discovered", async () => {
    const fetchSpy = vi.fn(async () => new Response("should never be fetched"));
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const githubLogUrlIssue: NormalizedIssue = {
        id: "gh-42",
        description: "# crash on export", // no URL in the description
        attachedLog: `trace: ${ATTACHMENT_URL}`,
        sourceType: "github-issue",
      };
      const deps = makeDeps({
        preflight: issueSandbox(githubLogUrlIssue, BASELINE_SUITE),
        sandbox: issueSandbox(githubLogUrlIssue, SUITE_AFTER_FIX),
      });

      const outcome = await runSingleIssue(
        { issue: githubLogUrlIssue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile }, // uncleared
        deps,
      );

      expect(outcome.prUrl).toBeTruthy(); // no gate refusal: nothing was discovered
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
