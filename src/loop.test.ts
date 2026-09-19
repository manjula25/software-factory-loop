import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  buildReviewPrompt,
  fixBranch,
  formatSummary,
  parseCap,
  parseSourceArgs,
  reproTestPath,
  runOverrideIssue,
  runQueue,
  runSingleIssue,
  syncMainToOrigin,
  type ProjectProfile,
} from "./loop.js";
import {
  REVIEW_BRANCH,
  boundedRunOptions,
  type AgentSpec,
  type FixRunOutcome,
  type FixSandboxHandle,
} from "./sandcastle-adapter.js";
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
/** Canary-red suite: one failure the baseline does not have — the red trigger (single-issue and queue seams share it). */
const CANARY_RED_SUITE = `FAILED tests/test_textops.py::TestTitlecase::test_capitalizes_each_word - AssertionError
FAILED tests/test_dates.py::TestParseIso8601::test_utc_timestamp_with_z - ValueError
FAILED tests/test_contract.py::test_zero_contract - ZeroDivisionError
3 failed, 4 passed in 0.8s`;

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

/**
 * WI-6 T4: a canary sandbox whose close() is observable — the canary must be
 * closed and its branch deleted on EVERY path (green, red, install failure).
 */
function trackedCanary(suiteOutput: string, installExit = 0): {
  handle: FixSandboxHandle & { commands: string[] };
  close: ReturnType<typeof vi.fn>;
} {
  const base = sandboxHandle(suiteOutput, 0, installExit);
  const close = vi.fn(async () => ({}));
  return { handle: { ...base, close }, close };
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
  /** Canary (post-merge) sandbox; defaults to a green suite (failures ⊆ baseline). */
  canary?: FixSandboxHandle;
  /** revertMerge result; defaults to a fixed revert commit. */
  revertCommit?: string;
  /** Simulated revert failure (conflict / push error) on canary-red runs. */
  revertThrows?: string;
  /** Simulated post-merge main-sync failure (divergent main) on opted-in runs (WI-7 FR-002). */
  syncThrows?: string;
  /** Simulated PR-comment failure on the uncanaried path (WI-7 FR-002). */
  commentThrows?: string;
  /** Simulated issue-close failure (gh error) on canary-green merged runs (WI-6 T5). */
  closeThrows?: string;
  /** Simulated canary-sandbox close() failure (container rm error) on opted-in runs (WI-7 FR-003). */
  canaryCloseThrows?: string;
  /** Simulated canary-branch delete failure on opted-in runs (WI-7 FR-003). */
  canaryDeleteBranchThrows?: string;
  /** Review-pass verdict (opted-in runs, WI-6 T6); defaults to approve. */
  reviewVerdict?: "approve" | "wrong" | "uncertain";
  /** Raw reviewer stdout — overrides reviewVerdict (off-contract replies). */
  reviewStdout?: string;
  /** The review run itself throws (API down / budget refusal). */
  reviewThrows?: string;
  /** The diff `fixDiff` returns — override to inject a secret-bearing diff (WI-7 FR-004 pin). */
  reviewDiff?: string;
}

function makeDeps(overrides: DepOverrides = {}) {
  const env = overrides.env ?? {};
  let sandboxCalls = 0;
  return {
    env,
    runFixRun: vi.fn(async (_input: { branch: string; prompt: string }) => overrides.fixOutcome ?? fixOutcome()),
    createFixSandbox: vi.fn(async (input: { branch: string }) => {
      // The canary sandbox is distinguished by its branch (loop/canary-<id>),
      // not by call order — the preflight (loop/preflight-<id>) also forks
      // from main, so baseBranch alone cannot tell them apart.
      if (input.branch.startsWith("loop/canary-")) {
        const base = overrides.canary ?? sandboxHandle(SUITE_AFTER_FIX);
        if (overrides.canaryCloseThrows !== undefined) {
          const message = overrides.canaryCloseThrows;
          return { ...base, async close() { throw new Error(message); } };
        }
        return base;
      }
      sandboxCalls += 1;
      return sandboxCalls === 1
        ? (overrides.preflight ?? sandboxHandle(BASELINE_SUITE))
        : (overrides.sandbox ?? sandboxHandle(SUITE_AFTER_FIX));
    }),
    deleteBranch: vi.fn(async (_repoDir: string, _branch: string) => {
      // WI-7 FR-003: teardown failure knob — the canary branch delete refuses.
      if (overrides.canaryDeleteBranchThrows !== undefined && _branch.startsWith("loop/canary-")) {
        throw new Error(overrides.canaryDeleteBranchThrows);
      }
    }),
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
    // WI-6 T4 seams
    syncMain: vi.fn(async (_repoDir: string) => {
      if (overrides.syncThrows !== undefined) {
        throw new Error(overrides.syncThrows);
      }
    }),
    revertMerge: vi.fn(async () => {
      if (overrides.revertThrows !== undefined) {
        throw new Error(overrides.revertThrows);
      }
      return { revertCommit: overrides.revertCommit ?? "r3vert0000" };
    }),
    commentOnPr: vi.fn(async (_input: { repoDir: string; prUrl: string; body: string }) => {
      if (overrides.commentThrows !== undefined) {
        throw new Error(overrides.commentThrows);
      }
    }),
    // WI-6 T5 seam
    closeIssue: vi.fn(async (_repoDir: string, _issue: NormalizedIssue, _comment: string) => {
      if (overrides.closeThrows !== undefined) {
        throw new Error(overrides.closeThrows);
      }
    }),
    // WI-6 T6 seams (FR-009): the diff under review + the bounded reviewer run.
    fixDiff: vi.fn(async (_repoDir: string, _branch: string) => overrides.reviewDiff ?? "diff-under-review"),
    runReview: vi.fn(async (_input: { cwd: string; prompt: string; diff: string }) => {
      if (overrides.reviewThrows !== undefined) {
        throw new Error(overrides.reviewThrows);
      }
      return overrides.reviewStdout ?? `<review>${overrides.reviewVerdict ?? "approve"}</review>`;
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
      canaryGreen: true, // WI-6 T4: `merged` now implies the canary ran and was green
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

// ---------------------------------------------------------------------------
// WI-6 T4: post-merge canary, auto-revert, run halt, @-mention notification
// (FR-005/006/007). The canary is a THIRD sandbox, on `loop/canary-<id>` from
// synced main, created only after a successful merge on an opted-in profile.
// ---------------------------------------------------------------------------

describe("post-merge canary, auto-revert, halt, notify (WI-6 T4, FR-005/006/007)", () => {
  const optedInNotify: ProjectProfile = { ...profile, autoMerge: true, notifyHandle: "manjula25" };
  const PR_URL = "https://github.com/manjula25/loop-fixtures-py/pull/9";
  const run = (deps: ReturnType<typeof makeDeps>, p: ProjectProfile) =>
    runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile: p }, deps);

  it("(a) merged success: syncMain first; canary sandbox created on loop/canary-<id> from main; install + testCmd run inside; result recorded; sandbox closed and canary branch deleted", async () => {
    const canary = trackedCanary(SUITE_AFTER_FIX); // green: failures ⊆ baseline
    const deps = makeDeps({ canary: canary.handle });

    const outcome = await run(deps, optedInNotify);

    expect(deps.syncMain).toHaveBeenCalledTimes(1);
    expect(deps.syncMain).toHaveBeenCalledWith("/tmp/repo");
    expect(deps.createFixSandbox).toHaveBeenCalledWith({
      cwd: "/tmp/repo",
      branch: "loop/canary-gh-1",
      baseBranch: "main",
      imageName: "sandcastle-loop",
    });
    expect(canary.handle.commands).toEqual([profile.installCmd, profile.testCmd]);
    expect(canary.close).toHaveBeenCalledTimes(1);
    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "loop/canary-gh-1");
    expect(outcome.merged).toEqual({ prUrl: PR_URL, mergeCommit: "m0ckmerge", canaryGreen: true });
    expect(outcome.failure).toBeUndefined();
    expect(deps.revertMerge).not.toHaveBeenCalled();
    expect(deps.commentOnPr).not.toHaveBeenCalled();
  });

  it("(b) canary green: outcome keeps merged and the queue proceeds to the next issue", async () => {
    const { deps } = makeQueueDeps({ issues: [queueIssue(1), queueIssue(2)] });

    const summary = await runQueue(
      queueRunInput({ profile: { ...profile, autoMerge: true, notifyHandle: "manjula25" } }),
      deps,
    );

    expect(summary.attempted).toEqual(["gh-1", "gh-2"]); // no halt after a green canary
    expect(summary.mergedPrs).toEqual([
      ["gh-1", "https://example/pr/fix/gh-1", "mdef456"],
      ["gh-2", "https://example/pr/fix/gh-2", "mdef456"],
    ]);
    expect(summary.reverted).toEqual([]);
    expect(deps.syncMain).toHaveBeenCalledWith("/tmp/repo");
    expect(deps.createFixSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "loop/canary-gh-1", baseBranch: "main" }),
    );
    expect(deps.revertMerge).not.toHaveBeenCalled();
    expect(deps.commentOnPr).not.toHaveBeenCalled();
  });

  it("(c) canary red (a failure NOT in baseline): revertMerge called with exactly the merge commit from the merge step; outcome is a harness-level REVERTED failure with the canary evidence", async () => {
    const deps = makeDeps({ canary: sandboxHandle(CANARY_RED_SUITE) });

    const outcome = await run(deps, optedInNotify);

    expect(deps.mergePr).toHaveBeenCalledTimes(1);
    expect(deps.revertMerge).toHaveBeenCalledTimes(1);
    expect(deps.revertMerge).toHaveBeenCalledWith({ repoDir: "/tmp/repo", mergeCommit: "m0ckmerge" });
    expect(outcome.merged).toBeUndefined();
    expect(outcome.prUrl).toBeUndefined(); // not counted fixed — the merge was reverted
    expect(outcome.failureKind).toBe("harness");
    expect(outcome.failure).toContain("REVERTED");
    expect(outcome.failure).toContain("gh-1");
    expect(outcome.failure).toContain("tests/test_contract.py::test_zero_contract"); // canary evidence
    expect(outcome.reverted).toMatchObject({
      id: "gh-1",
      prUrl: PR_URL,
      mergeCommit: "m0ckmerge",
      revertCommit: "r3vert0000",
      evidence: expect.stringContaining("tests/test_contract.py::test_zero_contract"),
    });
  });

  it("(c) canary red halts the queue: runQueue throws QueueAbortedError and no further admitted issue is attempted", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2)],
      canaryNewFailureFor: "gh-1",
    });

    const error = await runQueue(queueRunInput({ profile: { ...profile, autoMerge: true } }), deps).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(QueueAbortedError);
    const aborted = error as QueueAbortedError;
    expect(aborted.message).toMatch(/REVERTED.*gh-1/);
    expect(aborted.summary.attempted).toEqual(["gh-1"]); // gh-2 never ran
    expect(deps.createPr).toHaveBeenCalledTimes(1);
    expect(deps.runFixRun).toHaveBeenCalledTimes(1);
  });

  it("(d) canary red: exactly one comment on the merged PR, its body carrying @<notifyHandle> and REVERTED", async () => {
    const deps = makeDeps({ canary: sandboxHandle(CANARY_RED_SUITE) });

    await run(deps, optedInNotify);

    expect(deps.commentOnPr).toHaveBeenCalledTimes(1);
    const call = deps.commentOnPr.mock.calls[0]![0] as { repoDir: string; prUrl: string; body: string };
    expect(call.repoDir).toBe("/tmp/repo");
    expect(call.prUrl).toBe(PR_URL);
    expect(call.body).toContain("@manjula25");
    expect(call.body).toContain("REVERTED");
  });

  it("(d) commentOnPr is never called on green, opted-out, or merge-failure paths (syncMain/revertMerge likewise inert)", async () => {
    const green = makeDeps(); // default canary is green
    await run(green, optedInNotify);
    expect(green.commentOnPr).not.toHaveBeenCalled();

    const optedOut = makeDeps();
    await run(optedOut, { ...profile, notifyHandle: "manjula25" }); // no autoMerge
    expect(optedOut.mergePr).not.toHaveBeenCalled();
    expect(optedOut.syncMain).not.toHaveBeenCalled();
    expect(optedOut.commentOnPr).not.toHaveBeenCalled();

    const mergeFailed = makeDeps({ mergeThrows: "gh: conflict" });
    await run(mergeFailed, optedInNotify);
    expect(mergeFailed.syncMain).not.toHaveBeenCalled(); // no merge landed → no canary
    expect(mergeFailed.revertMerge).not.toHaveBeenCalled();
    expect(mergeFailed.commentOnPr).not.toHaveBeenCalled();
  });

  it("(e) canary red with notifyHandle ABSENT: the comment still posts, carries no @, and the summary says the notify handle is not configured (D6)", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1)],
      canaryNewFailureFor: "gh-1",
    });

    const error = await runQueue(queueRunInput({ profile: { ...profile, autoMerge: true } }), deps).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(QueueAbortedError);
    expect(deps.commentOnPr).toHaveBeenCalledTimes(1);
    const body = (deps.commentOnPr.mock.calls[0]![0] as { body: string }).body;
    expect(body).toContain("REVERTED");
    expect(body).not.toContain("@"); // no configured handle → no mention token at all
    const aborted = error as QueueAbortedError;
    expect(formatSummary(aborted.summary)).toContain("notify handle not configured");
  });

  it("(f) canary install failure → red path: reverted, harness-level, with the install failure named (D2)", async () => {
    const deps = makeDeps({ canary: sandboxHandle(SUITE_AFTER_FIX, 0, /* installExit */ 1) });

    const outcome = await run(deps, optedInNotify);

    expect(outcome.merged).toBeUndefined();
    expect(outcome.failureKind).toBe("harness");
    expect(outcome.failure).toContain("install");
    expect(deps.revertMerge).toHaveBeenCalledTimes(1);
  });

  it("(f) canary suite output unreadable (no summary token) → red path (D2: silence is not success)", async () => {
    const deps = makeDeps({ canary: sandboxHandle("") });

    const outcome = await run(deps, optedInNotify);

    expect(outcome.merged).toBeUndefined();
    expect(outcome.failureKind).toBe("harness");
    expect(outcome.failure).toMatch(/unreadable|summary/i);
    expect(deps.revertMerge).toHaveBeenCalledTimes(1);
  });

  it("(g) revertMerge throws: the run still halts (QueueAbortedError), the revert failure is recorded, and the comment is still attempted", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2)],
      canaryNewFailureFor: "gh-1",
      canaryRevertThrows: "git: revert conflict on main",
    });

    const error = await runQueue(queueRunInput({ profile: { ...profile, autoMerge: true } }), deps).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(QueueAbortedError); // halt is unconditional on red
    const aborted = error as QueueAbortedError;
    expect(aborted.message).toContain("revert conflict on main");
    expect(aborted.summary.attempted).toEqual(["gh-1"]);
    expect(deps.commentOnPr).toHaveBeenCalledTimes(1); // notification is best-effort, still attempted
    expect(aborted.summary.reverted[0]!.revertCommit).toBeUndefined();
    expect(formatSummary(aborted.summary)).toContain("notify handle not configured");
  });

  it("(h) formatSummary for a reverted run: ⚠️ REVERTED section names issue id, PR url, merge commit, revert commit, and canary evidence", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1)],
      canaryNewFailureFor: "gh-1",
    });

    const error = await runQueue(
      queueRunInput({ profile: { ...profile, autoMerge: true, notifyHandle: "manjula25" } }),
      deps,
    ).catch((e: unknown) => e);

    const aborted = error as QueueAbortedError;
    const text = formatSummary(aborted.summary);
    expect(text).toContain(
      "⚠️ REVERTED gh-1: pr https://example/pr/fix/gh-1 merge mdef456 revert rvrt789",
    );
    expect(text).toContain("canary:");
    expect(text).toContain("tests/test_contract.py::test_zero_contract");
    expect(text).toContain("notify: @manjula25");
  });

  it("--issue N override: a reverted outcome has no prUrl — the existing CLI failure path prints it and exits 1 (verified at the runOverrideIssue seam)", async () => {
    const { deps } = makeQueueDeps({
      issues: [issue],
      canaryNewFailureFor: "gh-1",
    });

    const result = await runOverrideIssue(
      { issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile: { ...profile, autoMerge: true } },
      deps,
    );

    expect(result.kind).toBe("run");
    const outcome = result.kind === "run" ? result.outcome : undefined;
    expect(outcome?.prUrl).toBeUndefined(); // the CLI's "no PR" branch: prints the failure, exit 1
    expect(outcome?.failureKind).toBe("harness");
    expect(outcome?.failure).toContain("REVERTED");
  });

  // -------------------------------------------------------------------------
  // WI-7 (FR-002): the uncanaried-merge failure surface. The merge LANDED but
  // the canary never ran — syncMain failed — so unlike a red canary there is
  // nothing to revert (the merge may be fine; the clone is stale/divergent).
  // The surface mirrors `reverted`: no prUrl on the outcome, a harness-level
  // failure, one best-effort PR comment, and a loud summary line of its own.
  // -------------------------------------------------------------------------

  it("(i) syncMain throws after a successful merge: an UNCANARIED outcome — harness-level, commented with the merge commit and sync failure, never reverted, no canary sandbox", async () => {
    const deps = makeDeps({ syncThrows: "divergent main" });

    const outcome = await run(deps, optedInNotify);

    expect(deps.mergePr).toHaveBeenCalledTimes(1); // the merge did land
    expect(outcome.prUrl).toBeUndefined(); // merged-but-unverified is not "fixed with a PR"
    expect(outcome.failureKind).toBe("harness");
    expect(outcome.uncanaried).toEqual({
      id: "gh-1",
      prUrl: PR_URL,
      mergeCommit: "m0ckmerge",
      syncFailure: "divergent main",
      commentNote: "posted",
    });
    expect(deps.commentOnPr).toHaveBeenCalledTimes(1);
    const call = deps.commentOnPr.mock.calls[0]![0] as { repoDir: string; prUrl: string; body: string };
    expect(call.repoDir).toBe("/tmp/repo");
    expect(call.prUrl).toBe(PR_URL);
    expect(call.body).toContain("m0ckmerge"); // names the merge commit
    expect(call.body).toContain("divergent main"); // and the sync failure
    expect(deps.revertMerge).not.toHaveBeenCalled(); // nothing was judged red — no revert
    // no canary: only the preflight and verification sandboxes ever existed
    expect(deps.createFixSandbox).toHaveBeenCalledTimes(2);
  });

  it("(j) queue mode: the sync failure aborts the queue and the summary carries the exact ⚠️ UNCANARIED MERGE line", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2)],
      syncMainThrowsFor: "gh-1",
    });

    const error = await runQueue(queueRunInput({ profile: { ...profile, autoMerge: true } }), deps).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(QueueAbortedError);
    const aborted = error as QueueAbortedError;
    expect(aborted.summary.attempted).toEqual(["gh-1"]); // gh-2 never ran
    expect(aborted.summary.uncanariedMerges).toEqual([
      [
        "gh-1",
        "pr https://example/pr/fix/gh-1 merge mdef456 — main sync failed: divergent main; comment: posted",
      ],
    ]);
    expect(formatSummary(aborted.summary)).toContain(
      "⚠️ UNCANARIED MERGE gh-1: pr https://example/pr/fix/gh-1 merge mdef456 — main sync failed: divergent main; comment: posted",
    );
  });

  it("(k) commentOnPr throws on the uncanaried path: the failure lands in commentNote and the abort still happens", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1)],
      syncMainThrowsFor: "gh-1",
      commentThrowsFor: "fix/gh-1",
    });

    const error = await runQueue(queueRunInput({ profile: { ...profile, autoMerge: true } }), deps).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(QueueAbortedError); // the comment is best-effort; the halt is not
    const aborted = error as QueueAbortedError;
    expect(aborted.summary.uncanariedMerges[0]![1]).toContain("comment: FAILED (gh: comment failed — network)");
    expect(formatSummary(aborted.summary)).toContain("UNCANARIED MERGE gh-1");
  });

  it("--issue N override: an uncanaried outcome has no prUrl — the existing CLI failure path prints it and exits 1 (verified at the runOverrideIssue seam)", async () => {
    const { deps } = makeQueueDeps({ issues: [issue], syncMainThrowsFor: "gh-1" });

    const result = await runOverrideIssue(
      { issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile: { ...profile, autoMerge: true } },
      deps,
    );

    expect(result.kind).toBe("run");
    const outcome = result.kind === "run" ? result.outcome : undefined;
    expect(outcome?.prUrl).toBeUndefined(); // the CLI's "no PR" branch: prints the failure, exit 1
    expect(outcome?.failureKind).toBe("harness");
    expect(outcome?.failure).toContain("UNCANARIED");
  });

  // -------------------------------------------------------------------------
  // WI-7 (FR-003): canary teardown failures. close() or the canary-branch
  // delete can fail AFTER the suite already decided the verdict — teardown is
  // bookkeeping, so a green canary stays merged (with the failure named) and a
  // red one still reverts (with the failure named in the record). The verdict
  // and its evidence are never overwritten.
  // -------------------------------------------------------------------------

  it("(l) green canary + close()-throwing canary sandbox: merged outcome stands (no revert), the teardown failure is recorded, and the MERGED summary line names it", async () => {
    // Single-issue seam: the green verdict survives the teardown failure.
    const deps = makeDeps({ canaryCloseThrows: "docker: container rm failed — busy" });

    const outcome = await run(deps, optedInNotify);

    expect(outcome.merged).toEqual({ prUrl: PR_URL, mergeCommit: "m0ckmerge", canaryGreen: true });
    expect(deps.revertMerge).not.toHaveBeenCalled(); // a teardown failure never reverts a green merge
    expect(outcome.reverted).toBeUndefined();
    expect(outcome.teardownFailure).toContain("docker: container rm failed — busy");

    // Queue seam: the failure rides the mergedPrs tuple into the summary line.
    const { deps: queueDeps } = makeQueueDeps({ issues: [queueIssue(1)], canaryCloseThrowsFor: "gh-1" });

    const summary = await runQueue(queueRunInput({ profile: { ...profile, autoMerge: true } }), queueDeps);

    expect(summary.reverted).toEqual([]); // the queue did not treat it as red
    expect(summary.mergedPrs).toEqual([
      ["gh-1", "https://example/pr/fix/gh-1", "mdef456", "docker: container rm failed — busy"],
    ]);
    expect(formatSummary(summary)).toContain(
      "MERGED gh-1: https://example/pr/fix/gh-1 @ mdef456 (canary: green; teardown: docker: container rm failed — busy)",
    );
  });

  it("(m) red canary + throwing canary deleteBranch: the revert path still runs, the canary evidence is preserved, and the teardown failure is named in the RevertedRecord and the ⚠️ REVERTED summary line", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1)],
      canaryNewFailureFor: "gh-1",
      canaryDeleteBranchThrowsFor: "gh-1",
    });

    const error = await runQueue(queueRunInput({ profile: { ...profile, autoMerge: true } }), deps).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(QueueAbortedError); // red halts the queue, teardown failure or not
    const aborted = error as QueueAbortedError;
    expect(deps.revertMerge).toHaveBeenCalledTimes(1); // the revert path ran unchanged
    const record = aborted.summary.reverted[0]!;
    // verdict preservation: the evidence is the suite's new failure, not a teardown error
    expect(record.evidence).toContain("tests/test_contract.py::test_zero_contract");
    expect(record.evidence).not.toContain("sandbox failed to run");
    expect(record.teardownFailure).toContain("git: branch -D refused — worktree busy");
    expect(formatSummary(aborted.summary)).toContain("teardown: git: branch -D refused — worktree busy");
  });
});

// ---------------------------------------------------------------------------
// WI-6 T5: issue closing on merge (FR-008). Ordering is fixed by D3:
// merge → canary green → close. Only gh-sourced issues are closed (file
// sources have nothing external to close); a canary-red issue was reverted
// and stays queued — never closed.
// ---------------------------------------------------------------------------

describe("issue closing on merge (WI-6 T5, FR-008)", () => {
  const optedIn: ProjectProfile = { ...profile, autoMerge: true };
  const PR_URL = "https://github.com/manjula25/loop-fixtures-py/pull/9";
  const run = (deps: ReturnType<typeof makeDeps>, issueToRun: NormalizedIssue, p: ProjectProfile = optedIn) =>
    runSingleIssue({ issue: issueToRun, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile: p }, deps);

  /** File-sourced fixtures — the repro path differs from the module-level gh fixture, so their runs use the per-issue sandbox. */
  const specIssue: NormalizedIssue = { id: "spec-slug-first-char", description: "# slug symptom", sourceType: "spec-doc" };
  const plainIssue: NormalizedIssue = { id: "list-stale-pin", description: "stale pin after restart", sourceType: "plain-list" };

  it("(a) merged + canary green + github-issue: closeIssue called exactly once with the issue and a comment naming the PR url and merge commit", async () => {
    const deps = makeDeps({ mergeCommit: "c105e777" });

    const outcome = await run(deps, issue);

    expect(deps.closeIssue).toHaveBeenCalledTimes(1);
    const [repoDir, closedIssue, comment] = deps.closeIssue.mock.calls[0]!;
    expect(repoDir).toBe("/tmp/repo");
    expect(closedIssue).toBe(issue);
    expect(comment).toContain(PR_URL);
    expect(comment).toContain("c105e777");
    expect(comment).toContain("canary"); // FR-008: the comment carries the canary result
    expect(outcome.merged).toMatchObject({ prUrl: PR_URL, mergeCommit: "c105e777", canaryGreen: true });
    expect(outcome.closeFailure).toBeUndefined();
  });

  it("(b) merged + green + spec-doc / plain-list: closeIssue never called, no error — nothing external to close", async () => {
    for (const target of [specIssue, plainIssue]) {
      const deps = makeDeps({ sandbox: issueSandbox(target, SUITE_AFTER_FIX) });

      const outcome = await run(deps, target);

      expect(deps.closeIssue).not.toHaveBeenCalled();
      expect(outcome.merged).toMatchObject({ canaryGreen: true });
      expect(outcome.closeFailure).toBeUndefined();
      expect(outcome.failure).toBeUndefined();
    }
  });

  it("(c) reverted (canary red): closeIssue never called even for a github-issue — the issue was reverted and stays queued (FR-006)", async () => {
    const deps = makeDeps({ canary: sandboxHandle(CANARY_RED_SUITE) });

    await run(deps, issue);

    expect(deps.revertMerge).toHaveBeenCalledTimes(1);
    expect(deps.closeIssue).not.toHaveBeenCalled();
  });

  it("(d) closeIssue throws: failure recorded loudly, outcome still merged, queue continues past it", async () => {
    const { deps } = makeQueueDeps({ issues: [queueIssue(1), queueIssue(2)], closeThrowsFor: "gh-1" });

    const summary = await runQueue(queueRunInput({ profile: optedIn }), deps);

    expect(summary.attempted).toEqual(["gh-1", "gh-2"]); // the queue continued past the failed close
    expect(summary.mergedPrs).toHaveLength(2);
    expect(summary.closeFailures).toEqual([["gh-1", expect.stringContaining("issue close failed")]]);
    expect(formatSummary(summary)).toContain("ISSUE CLOSE FAILED gh-1");

    // single-issue seam: the merged outcome stands, the failure is a note on it
    const single = makeDeps({ closeThrows: "gh: issue close failed — network" });
    const outcome = await run(single, issue);
    expect(outcome.merged).toMatchObject({ prUrl: PR_URL, canaryGreen: true });
    expect(outcome.closeFailure).toContain("network");
  });

  it("formatSummary MERGED line shows the canary result (T4 spec-review follow-up, sanctioned)", () => {
    const text = formatSummary({
      attempted: ["gh-1"],
      fixed: ["gh-1"],
      failed: [],
      skippedDuplicate: [],
      skippedMerged: [],
      notAdmitted: [],
      attachmentFailures: [],
      prUrls: ["https://example/pr/fix/gh-1"],
      mergedPrs: [["gh-1", "https://example/pr/fix/gh-1", "mdef456"]],
      mergeFailures: [],
      closeFailures: [],
      reviewSkipped: [],
      reverted: [],
      uncanariedMerges: [],
    });
    expect(text).toContain("MERGED gh-1: https://example/pr/fix/gh-1 @ mdef456 (canary: green)");
  });
});

// ---------------------------------------------------------------------------
// WI-6 T6: pre-merge diff-review pass (FR-009, completes FR-004's blocking
// order: verification → review → merge). One bounded cheap-model call judging
// `git diff main...fix/<id>` against the report; only an explicit approve
// reaches mergePr — anything else (wrong, uncertain, reviewer unavailable)
// leaves the PR open with a skip comment, and the queue continues.
// ---------------------------------------------------------------------------

describe("pre-merge review pass (WI-6 T6, FR-009)", () => {
  const optedIn: ProjectProfile = { ...profile, autoMerge: true };
  const PR_URL = "https://github.com/manjula25/loop-fixtures-py/pull/9";
  const run = (deps: ReturnType<typeof makeDeps>, p: ProjectProfile = optedIn) =>
    runSingleIssue({ issue, repoDir: "/tmp/repo", imageName: "sandcastle-loop", agent, profile: p }, deps);

  it("the review pass is bounded: one iteration on the throwaway loop/review branch, never a fix branch (D7, R2)", () => {
    const options = boundedRunOptions("review", REVIEW_BRANCH);
    expect(options.maxIterations).toBe(1); // constraint 5 — asserted once at the shared factory
    expect(options.branchStrategy).toEqual({ type: "branch", branch: "loop/review" });
  });

  it("buildReviewPrompt states the three-verdict contract, the reported issue, and the diff under review", () => {
    const prompt = buildReviewPrompt(issue, "+ def slugify(s):\n-     return s.lower()");
    expect(prompt).toContain(issue.description); // the report the diff is judged against
    expect(prompt).toContain("+ def slugify(s):"); // the diff itself
    for (const verdict of ["approve", "wrong", "uncertain"]) {
      expect(prompt).toContain(`<review>${verdict}</review>`);
    }
  });

  it("approve: the reviewer runs once on the guarded prompt with the diff, loop/review is deleted, and mergePr proceeds", async () => {
    const deps = makeDeps();
    const outcome = await run(deps);

    expect(deps.runReview).toHaveBeenCalledTimes(1);
    const call = deps.runReview.mock.calls[0]![0] as { cwd: string; prompt: string; diff: string };
    expect(call.cwd).toBe("/tmp/repo");
    expect(call.diff).toBe("diff-under-review");
    expect(call.prompt).toContain(issue.description);
    expect(call.prompt).toContain("diff-under-review");
    expect(call.prompt).toContain("<review>approve</review>");
    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", "loop/review");
    expect(deps.mergePr).toHaveBeenCalledTimes(1); // FR-004: review green → merge
    expect(outcome.merged).toMatchObject({ prUrl: PR_URL, canaryGreen: true });
    expect(outcome.reviewSkip).toBeUndefined();
  });

  it("wrong: mergePr NEVER called (no canary either), the skip reason is commented on the PR, the run continues with a PR'd outcome and a loud reviewSkip", async () => {
    const deps = makeDeps({ reviewVerdict: "wrong" });
    const outcome = await run(deps);

    expect(deps.mergePr).not.toHaveBeenCalled();
    expect(deps.syncMain).not.toHaveBeenCalled(); // no merge landed → no canary spend
    expect(deps.commentOnPr).toHaveBeenCalledTimes(1);
    const call = deps.commentOnPr.mock.calls[0]![0] as { repoDir: string; prUrl: string; body: string };
    expect(call.repoDir).toBe("/tmp/repo");
    expect(call.prUrl).toBe(PR_URL);
    expect(call.body).toContain("wrong");
    expect(outcome.prUrl).toBe(PR_URL); // the PR is the deliverable — the run continues
    expect(outcome.failure).toBeUndefined(); // never an issue failure
    expect(outcome.reviewSkip).toContain("wrong");
  });

  it("a verdict that fails to parse counts as uncertain: no merge, skip comment, PR stays open (FR-009 boundary)", async () => {
    const deps = makeDeps({ reviewStdout: "<review>maybe</review>" });
    const outcome = await run(deps);

    expect(deps.mergePr).not.toHaveBeenCalled();
    expect(deps.commentOnPr).toHaveBeenCalledTimes(1);
    expect((deps.commentOnPr.mock.calls[0]![0] as { body: string }).body).toContain("uncertain");
    expect(outcome.reviewSkip).toContain("uncertain");
    expect(outcome.prUrl).toBe(PR_URL);
  });

  it("a thrown review run maps to uncertain (D7): no merge, skip comment, run continues", async () => {
    const deps = makeDeps({ reviewThrows: "provider: 503 unavailable" });
    const outcome = await run(deps);

    expect(deps.mergePr).not.toHaveBeenCalled();
    expect(deps.commentOnPr).toHaveBeenCalledTimes(1);
    expect((deps.commentOnPr.mock.calls[0]![0] as { body: string }).body).toContain("uncertain");
    expect(outcome.prUrl).toBe(PR_URL);
    expect(outcome.reviewSkip).toContain("503 unavailable");
  });

  it("(WI-7 FR-004 pin) a diff carrying an env value NEVER reaches the reviewer: runReview is not called, the PR stays open with the review-skip shape", async () => {
    // Synthetic fixture token — nothing from a real .env (env values are never
    // echoed). The guard env is deps.env, exactly what the loop hands
    // assertNoSecrets before the third-party review call.
    const SYNTHETIC_TOKEN = "synthetic-token-abcdef"; // >= the guard's min length
    const deps = makeDeps({
      env: { CLI_PROXY_API_TOKEN: SYNTHETIC_TOKEN },
      reviewDiff: `+ API_TOKEN = "${SYNTHETIC_TOKEN}"`,
    });
    const outcome = await run(deps);

    expect(deps.runReview).not.toHaveBeenCalled(); // blocked BEFORE the call, not after
    expect(deps.mergePr).not.toHaveBeenCalled();
    expect(deps.commentOnPr).toHaveBeenCalledTimes(1);
    const body = (deps.commentOnPr.mock.calls[0]![0] as { body: string }).body;
    expect(body).toContain("CLI_PROXY_API_TOKEN"); // names the KEY...
    expect(body).not.toContain(SYNTHETIC_TOKEN); // ...never the value
    expect(outcome.prUrl).toBe(PR_URL); // the PR is the deliverable — it stays open
    expect(outcome.failure).toBeUndefined(); // a blocked review is never an issue failure
    expect(outcome.reviewSkip).toContain("CLI_PROXY_API_TOKEN");
    expect(outcome.reviewSkip).not.toContain(SYNTHETIC_TOKEN);
  });

  it("(WI-7 FR-004 pin) a thrown review run still deletes the throwaway loop/review branch — a failed pass never leaks it", async () => {
    const deps = makeDeps({ reviewThrows: "provider: 503 unavailable" });
    const outcome = await run(deps);

    expect(deps.deleteBranch).toHaveBeenCalledWith("/tmp/repo", REVIEW_BRANCH);
    expect(deps.mergePr).not.toHaveBeenCalled();
    expect(outcome.prUrl).toBe(PR_URL);
    expect(outcome.reviewSkip).toContain("503 unavailable");
  });

  it("opted-out repo: the reviewer is never invoked — no review spend, even on a would-be-wrong verdict (FR-009)", async () => {
    const deps = makeDeps({ reviewVerdict: "wrong" });
    const outcome = await run(deps, profile); // no autoMerge

    expect(deps.fixDiff).not.toHaveBeenCalled();
    expect(deps.runReview).not.toHaveBeenCalled();
    expect(deps.mergePr).not.toHaveBeenCalled();
    expect(outcome.prUrl).toBe(PR_URL);
    expect(outcome.reviewSkip).toBeUndefined();
  });

  it("the queue records the skip loudly and continues: reviewSkipped in the summary, REVIEW SKIP lines, never a failed entry", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2)],
      reviewVerdict: "uncertain",
    });

    const summary = await runQueue(queueRunInput({ profile: optedIn }), deps);

    expect(summary.attempted).toEqual(["gh-1", "gh-2"]); // the run continued past both skips
    expect(summary.fixed).toEqual(["gh-1", "gh-2"]); // PR'd = fixed, exactly like a merge failure
    expect(summary.failed).toEqual([]); // a review skip is never an issue failure
    expect(summary.mergedPrs).toEqual([]);
    expect(summary.reviewSkipped).toEqual([
      ["gh-1", expect.stringContaining("uncertain")],
      ["gh-2", expect.stringContaining("uncertain")],
    ]);
    const text = formatSummary(summary);
    expect(text).toContain("REVIEW SKIP gh-1:");
    expect(text).toContain("REVIEW SKIP gh-2:");
  });
});

describe("syncMainToOrigin (WI-6 T4 defect fix — real git wiring, FR-005/D3)", () => {
  // The T7 live run proved `git fetch origin main:main` can never sync a main
  // that is CHECKED OUT (git refuses the ref update) — and loop target clones
  // always sit on main. These tests drive the real wiring against throwaway
  // git repositories: no stubs can catch this class.
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  /** Advance upstream main by one commit ("two") — the shared sync preamble. */
  const advanceUpstream = (dir: string) => {
    writeFileSync(join(dir, "a.txt"), "two\n");
    git(dir, "add", "a.txt");
    git(dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "two");
  };

  const makeRepoPair = async () => {
    const root = await mkdtemp(join(tmpdir(), "syncmain-"));
    const upstream = join(root, "upstream");
    const target = join(root, "target");
    mkdirSync(upstream);
    git(upstream, "init", "-q", "-b", "main");
    writeFileSync(join(upstream, "a.txt"), "one\n");
    git(upstream, "add", "a.txt");
    git(upstream, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "one");
    git(upstream, "clone", "-q", upstream, target);
    return { root, upstream, target };
  };

  it("fast-forwards a CHECKED-OUT main to origin (the case the loop always hits)", () => {
    return makeRepoPair().then(({ root, upstream, target }) => {
      try {
        advanceUpstream(upstream);
        expect(git(target, "rev-parse", "HEAD")).not.toBe(git(upstream, "rev-parse", "HEAD"));
        expect(() => syncMainToOrigin(target)).not.toThrow();
        expect(git(target, "rev-parse", "HEAD")).toBe(git(upstream, "rev-parse", "HEAD"));
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  it("syncs main via the fetch-ref form when main is NOT the current branch", () => {
    return makeRepoPair().then(({ root, upstream, target }) => {
      try {
        advanceUpstream(upstream);
        git(target, "checkout", "-q", "-b", "fix/other");
        expect(() => syncMainToOrigin(target)).not.toThrow();
        expect(git(target, "rev-parse", "main")).toBe(git(upstream, "rev-parse", "HEAD"));
        expect(git(target, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("fix/other");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  it("throws loudly on a divergent main — no canary on a main we cannot sync", () => {
    return makeRepoPair().then(({ root, upstream, target }) => {
      try {
        advanceUpstream(upstream);
        writeFileSync(join(target, "b.txt"), "local\n");
        git(target, "add", "b.txt");
        git(target, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "local");
        expect(() => syncMainToOrigin(target)).toThrow();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  it("(WI-7 FR-004 pin) divergent main NOT checked out: the fetch-ref form refuses the non-fast-forward update and throws, leaving local main untouched", () => {
    // BOUNDARY-PIN: this asserts stock git behavior — `git fetch origin
    // main:main` refuses a non-fast-forward ref update. The wiring under test
    // is the one-line choice of the fetch-ref form for a non-checked-out
    // main; making this test RED would require mutating git itself, not our
    // code, so the mutation-check discipline of the FR-004 wired pins does
    // not apply here.
    return makeRepoPair().then(({ root, upstream, target }) => {
      try {
        // origin/main moves ahead
        advanceUpstream(upstream);
        // local main gains its own commit — main is now diverged from origin/main
        writeFileSync(join(target, "b.txt"), "local\n");
        git(target, "add", "b.txt");
        git(target, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "local");
        const localMain = git(target, "rev-parse", "main");
        // then leave main — the loop's fix/canary branches sit elsewhere
        git(target, "checkout", "-q", "-b", "fix/other");
        expect(() => syncMainToOrigin(target)).toThrow();
        expect(git(target, "rev-parse", "main")).toBe(localMain); // never clobbered
        expect(git(target, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("fix/other");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  it("prunes stale remote-tracking refs — gh --delete-branch after a merge leaves them, and the next run on the same issue forks its fix branch from the stale ref (T7 live finding #2)", () => {
    return makeRepoPair().then(({ root, upstream, target }) => {
      try {
        // Simulate the post-merge state: a fix branch pushed, then deleted on
        // the remote WITHOUT a prune (exactly what `gh pr merge
        // --delete-branch` leaves behind in the target clone).
        git(target, "checkout", "-q", "-b", "fix/gh-1");
        writeFileSync(join(target, "c.txt"), "fix\n");
        git(target, "add", "c.txt");
        git(target, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fix");
        git(target, "push", "-q", "origin", "fix/gh-1");
        advanceUpstream(upstream);
        git(upstream, "branch", "-D", "fix/gh-1");
        expect(git(target, "branch", "-r")).toContain("origin/fix/gh-1"); // stale ref present
        expect(() => syncMainToOrigin(target)).not.toThrow();
        expect(git(target, "branch", "-r")).not.toContain("origin/fix/gh-1"); // pruned
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
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
  installExit = 0,
): FixSandboxHandle {
  return {
    branch: fixBranch(target),
    worktreePath: "/tmp/wt",
    async exec(command: string) {
      if (command === profile.installCmd) {
        return { exitCode: installExit, stdout: "", stderr: installExit === 0 ? "" : "pip: build failed" };
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
  /** Canary (post-merge) suite shows a NEW failure for this id — the red path. */
  canaryNewFailureFor?: string;
  /** Canary suite output has no summary token — unreadable → red path (D2). */
  canaryUnreadableFor?: string;
  /** Canary install command fails for this id — red path (D2). */
  canaryInstallFailFor?: string;
  /** revertMerge throws (conflict/push error) — best-effort revert fails loudly. */
  canaryRevertThrows?: string;
  /** Post-merge main sync throws for this id — the uncanaried-merge path (WI-7 FR-002). */
  syncMainThrowsFor?: string;
  /** The uncanaried PR comment throws for PRs whose url contains this token (WI-7 FR-002). */
  commentThrowsFor?: string;
  /** Issue close throws (gh error) for this id — bookkeeping failure on a merged outcome (WI-6 T5). */
  closeThrowsFor?: string;
  /** Canary-sandbox close() throws for this id — teardown failure on an opted-in run (WI-7 FR-003). */
  canaryCloseThrowsFor?: string;
  /** Canary-branch delete throws for this id — teardown failure on an opted-in run (WI-7 FR-003). */
  canaryDeleteBranchThrowsFor?: string;
  /** Review-pass verdict for every opted-in issue (WI-6 T6); defaults to approve. */
  reviewVerdict?: "approve" | "wrong" | "uncertain";
  /** Raw reviewer stdout — overrides reviewVerdict (off-contract replies). */
  reviewStdout?: string;
  /** The review run itself throws for every issue (API down / budget refusal). */
  reviewThrows?: string;
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
      // The canary also forks from main, so dispatch on its branch prefix.
      if (input.branch.startsWith("loop/canary-")) {
        const suite = config.canaryUnreadableFor === active.id
          ? ""
          : config.canaryNewFailureFor === active.id
            ? CANARY_RED_SUITE
            : SUITE_AFTER_FIX;
        const handle = issueSandbox(active, suite, 0, config.canaryInstallFailFor === active.id ? 1 : 0);
        // WI-7 FR-003: the canary sandbox's close() can be made to refuse.
        if (config.canaryCloseThrowsFor === active.id) {
          return track({ ...handle, async close() { throw new Error("docker: container rm failed — busy"); } });
        }
        return track(handle);
      }
      if (input.baseBranch === "main") {
        // baseline preflight
        const stale = config.staleBaseline === true || config.staleBaselineFor === active.id;
        return track(issueSandbox(active, stale ? SUITE_AFTER_FIX : BASELINE_SUITE));
      }
      const fails = config.failReproFor === active.id;
      return track(issueSandbox(active, SUITE_AFTER_FIX, fails ? 1 : 0));
    }),
    deleteBranch: vi.fn(async (_repoDir: string, _branch: string) => {
      // WI-7 FR-003: the canary branch delete can be made to refuse.
      if (config.canaryDeleteBranchThrowsFor !== undefined && _branch === `loop/canary-${config.canaryDeleteBranchThrowsFor}`) {
        throw new Error("git: branch -D refused — worktree busy");
      }
    }),
    createPr: vi.fn(async (args: { head: string }) => ({ url: `https://example/pr/${args.head}` })),
    mergePr: vi.fn(async (input: { prUrl: string }) => {
      if (config.mergeThrowsFor !== undefined && input.prUrl.includes(config.mergeThrowsFor)) {
        throw new Error("gh: merge conflict — base branch moved");
      }
      return { mergeCommit: "mdef456" };
    }),
    // WI-6 T4 seams
    syncMain: vi.fn(async (_repoDir: string) => {
      if (config.syncMainThrowsFor !== undefined) {
        throw new Error("divergent main");
      }
    }),
    revertMerge: vi.fn(async () => {
      if (config.canaryRevertThrows !== undefined) {
        throw new Error(config.canaryRevertThrows);
      }
      return { revertCommit: "rvrt789" };
    }),
    commentOnPr: vi.fn(async (_input: { repoDir: string; prUrl: string; body: string }) => {
      if (config.commentThrowsFor !== undefined) {
        throw new Error("gh: comment failed — network");
      }
    }),
    // WI-6 T5 seam
    closeIssue: vi.fn(async (_repoDir: string, target: NormalizedIssue, _comment: string) => {
      if (config.closeThrowsFor !== undefined && target.id === config.closeThrowsFor) {
        throw new Error("gh: issue close failed — network");
      }
    }),
    // WI-6 T6 seams (FR-009)
    fixDiff: vi.fn(async (_repoDir: string, _branch: string) => "diff-under-review"),
    runReview: vi.fn(async (_input: { cwd: string; prompt: string; diff: string }) => {
      if (config.reviewThrows !== undefined) {
        throw new Error(config.reviewThrows);
      }
      return config.reviewStdout ?? `<review>${config.reviewVerdict ?? "approve"}</review>`;
    }),
    // QueueDeps
    ghJson: vi.fn((_args: string[], _cwd: string) =>
      JSON.stringify(issues.map((i) => ({ number: Number(i.id.slice(3)), title: i.description, body: null })))),
    refreshRemoteRefs: vi.fn(async () => {}),
    listOpenPrs: vi.fn(async () => config.prs ?? []),
    listMergedPrs: vi.fn(async () => config.mergedPrs ?? []),
    mainRevertsPr: vi.fn(async () => false),
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
    const mergedAt = lines.findIndex(
      (l) => l === "MERGED gh-1: https://example/pr/fix/gh-1 @ mdef456 (canary: green)",
    );
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
