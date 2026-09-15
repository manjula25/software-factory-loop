import { describe, expect, it, vi } from "vitest";
import { assertNoSecrets } from "./assert-no-secrets.js";
import {
  LOOP_IDENTITY,
  buildFixPrompt,
  buildPrBody,
  fixBranch,
  parseCap,
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

describe("buildPrBody", () => {
  it("produces a body that itself passes the secrets guard", () => {
    const body = buildPrBody(issue, RED, GREEN, { passed: true, newFailures: [] });
    expect(() => assertNoSecrets([body], { CLI_PROXY_API_URL: "http://x.local:1" })).not.toThrow();
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
  /** Id whose verification sandbox fails the reproduction test (issue-level failure). */
  failReproFor?: string;
  /** Preflight reports a stale baseline for every issue (harness-level abort). */
  staleBaseline?: boolean;
  triageStdout?: string;
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
      if (input.baseBranch === "main") {
        // baseline preflight
        return track(issueSandbox(active, config.staleBaseline ? SUITE_AFTER_FIX : BASELINE_SUITE));
      }
      const fails = config.failReproFor === active.id;
      return track(issueSandbox(active, SUITE_AFTER_FIX, fails ? 1 : 0));
    }),
    deleteBranch: vi.fn(async (_repoDir: string, _branch: string) => {}),
    createPr: vi.fn(async (args: { head: string }) => ({ url: `https://example/pr/${args.head}` })),
    // QueueDeps
    ghJson: vi.fn((_args: string[], _cwd: string) =>
      JSON.stringify(issues.map((i) => ({ number: Number(i.id.slice(3)), title: i.description, body: null })))),
    listOpenPrs: vi.fn(async () => config.prs ?? []),
    listFixBranches: vi.fn(async () => []),
    deleteRemoteBranch: vi.fn(async () => {}),
    runTriage: vi.fn(async () => config.triageStdout ?? ""),
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

  it("aborts the whole queue on a harness-level failure (stale baseline), attempting nothing further", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2)],
      staleBaseline: true,
    });

    await expect(runQueue(queueRunInput(), deps)).rejects.toThrow(/queue aborted/i);
    expect(deps.runFixRun).not.toHaveBeenCalled();
    expect(deps.createPr).not.toHaveBeenCalled();
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

  it("under an under-cap queue, triage is not invoked even with the flag set", async () => {
    const { deps } = makeQueueDeps({
      issues: [queueIssue(1), queueIssue(2)],
      triageStdout: '<triage>{"scores":{"gh-1":1,"gh-2":2},"files":{}}</triage>',
    });

    const summary = await runQueue(queueRunInput({ cap: 3, triage: true }), deps);

    expect(summary.attempted).toEqual(["gh-1", "gh-2"]);
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
