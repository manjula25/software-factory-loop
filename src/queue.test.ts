import { describe, expect, it } from "vitest";
import {
  listOpenIssues,
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
