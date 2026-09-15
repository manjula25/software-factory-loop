import { describe, expect, it } from "vitest";
import {
  admitIssues,
  listOpenIssues,
  parseTriageOutput,
  QueueAcquisitionError,
  splitQueue,
  type QueueDeps,
} from "./queue.js";
import type { NormalizedIssue } from "./issues.js";
import type { LoopDeps } from "./loop.js";

type SplitDeps = QueueDeps & Pick<LoopDeps, "deleteBranch">;

function makeDeps(overrides: Partial<SplitDeps> = {}): SplitDeps {
  return {
    ghJson: () => "[]",
    listOpenPrs: async () => [],
    listFixBranches: async () => [],
    deleteRemoteBranch: async () => {},
    deleteBranch: async () => {},
    ...overrides,
  };
}

function issue(n: number): NormalizedIssue {
  return { id: `gh-${n}`, description: `# issue ${n}`, sourceType: "github-issue" };
}

describe("queue acquisition (WI-2 T1)", () => {
  it("normalizes every open issue, with attachedLog iff a fenced block exists", async () => {
    const payload = JSON.stringify([
      {
        number: 1,
        title: "crash on startup",
        body: "Stack:\n```\nTraceback (most recent call last):\n  boom\n```",
        url: "https://example/i/1",
      },
      { number: 2, title: "docs typo", body: "README wrong.", url: "https://example/i/2" },
      { number: 3, title: "empty body", body: null },
    ]);
    const issues = await listOpenIssues(makeDeps({ ghJson: () => payload }), { repo: "owner/name" });

    expect(issues).toHaveLength(3);
    expect(issues[0]).toMatchObject({
      id: "gh-1",
      sourceType: "github-issue",
      url: "https://example/i/1",
    });
    expect(issues[0]?.attachedLog).toContain("Traceback");
    expect(issues[1]?.attachedLog).toBeUndefined();
    expect(issues[2]?.attachedLog).toBeUndefined();
    expect(issues[2]?.description).toBe("# empty body");
  });

  it("passes --label through when given and omits it otherwise", async () => {
    const calls: string[][] = [];
    const deps = makeDeps({
      ghJson: (args) => {
        calls.push(args);
        return "[]";
      },
    });

    await listOpenIssues(deps, { repo: "owner/name", label: "bug" });
    await listOpenIssues(deps, { repo: "owner/name" });

    expect(calls[0]).toContain("--label");
    expect(calls[0]).toContain("bug");
    expect(calls[1]).not.toContain("--label");
  });

  it("returns [] for an empty result but throws QueueAcquisitionError on gh failure", async () => {
    const empty = await listOpenIssues(makeDeps({ ghJson: () => "[]" }), { repo: "owner/name" });
    expect(empty).toEqual([]);

    await expect(
      listOpenIssues(makeDeps({ ghJson: () => { throw new Error("gh exited 1"); } }), {
        repo: "owner/name",
      }),
    ).rejects.toBeInstanceOf(QueueAcquisitionError);
  });
});

describe("dedup and stale-branch handling (WI-2 T2)", () => {
  it("skips issues with an open PR, deletes stale branches, keeps the rest eligible", async () => {
    const localDeleted: string[] = [];
    const remoteDeleted: string[] = [];
    const deps = makeDeps({
      listOpenPrs: async () => [{ headRefName: "fix/gh-1", body: "" }],
      listFixBranches: async () => ["fix/gh-1", "fix/gh-2"],
      deleteBranch: async (_dir, branch) => {
        localDeleted.push(branch);
      },
      deleteRemoteBranch: async (_dir, branch) => {
        remoteDeleted.push(branch);
      },
    });

    const result = await splitQueue(deps, "/repo", [issue(1), issue(2), issue(3)]);

    expect(result.skippedDuplicate).toEqual(["gh-1"]);
    expect(result.eligible.map((i) => i.id)).toEqual(["gh-2", "gh-3"]);
    expect(localDeleted).toEqual(["fix/gh-2"]);
    expect(remoteDeleted).toEqual(["fix/gh-2"]);
  });

  it("matches issue ids as exact tokens — gh-1 never matches a body mentioning gh-11", async () => {
    const deps = makeDeps({
      listOpenPrs: async () => [{ headRefName: "feature/other", body: "see gh-11 also" }],
    });

    const result = await splitQueue(deps, "/repo", [issue(1)]);

    expect(result.skippedDuplicate).toEqual([]);
    expect(result.eligible.map((i) => i.id)).toEqual(["gh-1"]);
  });

  it("aborts with QueueAcquisitionError on a PR-listing failure, deleting nothing", async () => {
    const localDeleted: string[] = [];
    const remoteDeleted: string[] = [];
    const deps = makeDeps({
      listOpenPrs: async () => {
        throw new Error("gh pr list exited 1");
      },
      listFixBranches: async () => ["fix/gh-2"],
      deleteBranch: async (_dir, branch) => {
        localDeleted.push(branch);
      },
      deleteRemoteBranch: async (_dir, branch) => {
        remoteDeleted.push(branch);
      },
    });

    await expect(splitQueue(deps, "/repo", [issue(2)])).rejects.toBeInstanceOf(
      QueueAcquisitionError,
    );
    expect(localDeleted).toEqual([]);
    expect(remoteDeleted).toEqual([]);
  });
});

describe("admission: cap, deterministic default, opt-in triage (WI-2 T3)", () => {
  const five = [1, 2, 3, 4, 5].map(issue);

  it("admits the first cap issues in ascending order without triage — no model call", () => {
    const result = admitIssues({ issues: five, cap: 3 });

    expect(result.admitted.map((i) => i.id)).toEqual(["gh-1", "gh-2", "gh-3"]);
    expect(result.notAdmitted).toEqual([
      { issue: five[3], reason: "cap" },
      { issue: five[4], reason: "cap" },
    ]);
    expect(result.degraded).toBe(false);
  });

  it("orders by returned score, ties by ascending issue number", () => {
    const result = admitIssues({
      issues: five,
      cap: 3,
      triage: {
        scores: { "gh-1": 2, "gh-2": 5, "gh-3": 5, "gh-4": 4, "gh-5": 1 },
        files: {},
      },
    });

    expect(result.admitted.map((i) => i.id)).toEqual(["gh-2", "gh-3", "gh-4"]);
  });

  it("defers a file-overlapping issue and admits the next non-overlapping candidate (decision 14)", () => {
    const result = admitIssues({
      issues: five,
      cap: 2,
      triage: {
        scores: { "gh-1": 5, "gh-2": 4, "gh-3": 3, "gh-4": 2, "gh-5": 1 },
        files: {
          "gh-1": ["src/calculator.py"],
          "gh-2": ["src/calculator.py", "src/other.py"],
          "gh-3": ["src/disjoint.py"],
          "gh-4": [],
          "gh-5": [],
        },
      },
    });

    expect(result.admitted.map((i) => i.id)).toEqual(["gh-1", "gh-3"]);
    expect(result.notAdmitted).toEqual([
      { issue: five[1], reason: "file overlap with gh-1" },
      { issue: five[3], reason: "cap" },
      { issue: five[4], reason: "cap" },
    ]);
  });

  it("degrades to deterministic order when the triage pass ran but its output was unusable", () => {
    const result = admitIssues({ issues: five, cap: 3, triageUnusable: true });

    expect(result.admitted.map((i) => i.id)).toEqual(["gh-1", "gh-2", "gh-3"]);
    expect(result.degraded).toBe(true);
  });
});

describe("parseTriageOutput (WI-2 T3, Zod-validated)", () => {
  const ids = ["gh-1", "gh-2"];

  it("parses a well-formed triage block", () => {
    const stdout =
      'prose\n<triage>{"scores":{"gh-1":3,"gh-2":5},"files":{"gh-1":["src/a.py"],"gh-2":[]}}</triage>\nmore prose';
    const parsed = parseTriageOutput(stdout, ids);

    expect(parsed).toEqual({
      scores: { "gh-1": 3, "gh-2": 5 },
      files: { "gh-1": ["src/a.py"], "gh-2": [] },
    });
  });

  it("rejects garbage, missing ids, out-of-range scores, and non-integer scores", () => {
    expect(parseTriageOutput("no tags at all", ids)).toBeUndefined();
    expect(
      parseTriageOutput('<triage>{"scores":{"gh-1":3},"files":{}}</triage>', ids),
    ).toBeUndefined(); // gh-2 missing from scores
    expect(
      parseTriageOutput('<triage>{"scores":{"gh-1":9,"gh-2":1},"files":{}}</triage>', ids),
    ).toBeUndefined(); // 9 out of the 1-5 range
    expect(
      parseTriageOutput('<triage>{"scores":{"gh-1":3.5,"gh-2":1},"files":{}}</triage>', ids),
    ).toBeUndefined(); // non-integer
    expect(parseTriageOutput("<triage>not json</triage>", ids)).toBeUndefined();
  });
});
