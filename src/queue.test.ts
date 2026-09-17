import { describe, expect, it } from "vitest";
import {
  admitIssues,
  buildTriagePrompt,
  ISSUE_PAGE_LIMIT,
  listOpenIssues,
  openPrListArgs,
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

  it("pins the open-PR page explicitly, never narrower than the issue page", () => {
    // gh pr list defaults to 30 silently: past that, a fix already in flight
    // reads as absent and the harness opens a competing PR.
    const args = openPrListArgs();
    const at = args.indexOf("--limit");

    expect(at).toBeGreaterThan(-1);
    expect(Number(args[at + 1])).toBeGreaterThanOrEqual(ISSUE_PAGE_LIMIT);
    expect(args).toContain("--state");
    expect(args).toContain("open");
  });

  it("matches an id however a human capitalized it in the PR body", async () => {
    const deps = makeDeps({
      listOpenPrs: async () => [{ headRefName: "feature/other", body: "Fixes GH-1" }],
    });

    const result = await splitQueue(deps, "/repo", [issue(1)]);

    expect(result.skippedDuplicate).toEqual(["gh-1"]);
    expect(result.eligible).toEqual([]);
  });

  it("treats a regex metacharacter in an id as literal text, not a pattern", async () => {
    // Non-GitHub sources (spec documents, plain lists) are in PRD scope, so an
    // id is not guaranteed to be `gh-N`.
    const dotted: NormalizedIssue = {
      id: "spec-1.2",
      description: "# from a spec document",
      sourceType: "github-issue",
    };
    const deps = makeDeps({
      listOpenPrs: async () => [{ headRefName: "feature/other", body: "covers spec-1x2" }],
    });

    const result = await splitQueue(deps, "/repo", [dotted]);

    // "." must not match the "x" — the issue is still eligible
    expect(result.skippedDuplicate).toEqual([]);
    expect(result.eligible.map((i) => i.id)).toEqual(["spec-1.2"]);
  });

  it("PARITY PIN (WI-3 T5): the dedup is source-agnostic over a mixed queue — spec ids skip on a PR-body mention, stale list branches are deleted and retried", async () => {
    // Pins current production behavior: splitQueue dedups by id token and
    // fix/<id> branch, whatever prefix the id carries. Zero production change
    // in this file is the point — if this test forces one, that is a plan
    // deviation.
    const mixed: NormalizedIssue[] = [
      { id: "gh-1", description: "# gh one", sourceType: "github-issue" },
      { id: "spec-camera-json", description: "# camera JSON", sourceType: "spec-doc" },
      { id: "list-stale-pin", description: "stale pin after restart", sourceType: "plain-list" },
    ];
    const localDeleted: string[] = [];
    const remoteDeleted: string[] = [];
    const deps = makeDeps({
      listOpenPrs: async () => [
        { headRefName: "feature/other", body: "this PR already covers spec-camera-json" },
      ],
      listFixBranches: async () => ["fix/list-stale-pin"],
      deleteBranch: async (_dir, branch) => {
        localDeleted.push(branch);
      },
      deleteRemoteBranch: async (_dir, branch) => {
        remoteDeleted.push(branch);
      },
    });

    const result = await splitQueue(deps, "/repo", mixed);

    expect(result.skippedDuplicate).toEqual(["spec-camera-json"]);
    expect(result.eligible.map((i) => i.id)).toEqual(["gh-1", "list-stale-pin"]);
    expect(result.staleBranchesDeleted).toEqual(["fix/list-stale-pin"]);
    expect(localDeleted).toEqual(["fix/list-stale-pin"]);
    expect(remoteDeleted).toEqual(["fix/list-stale-pin"]);
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

describe("buildTriagePrompt (WI-2 T3)", () => {
  it("lists every queued id with its first description line, and nothing more", () => {
    const multiline: NormalizedIssue = {
      id: "gh-7",
      description: "# crash on empty input\n\nStack trace follows\nline two",
      sourceType: "github-issue",
    };

    const prompt = buildTriagePrompt([issue(1), multiline]);

    expect(prompt).toContain("- gh-1: # issue 1");
    // only the first line travels — the body can be long, and the pass is bounded
    expect(prompt).toContain("- gh-7: # crash on empty input");
    expect(prompt).not.toContain("Stack trace follows");
    expect(prompt).not.toContain("line two");
  });

  it("asks for the exact block shape parseTriageOutput accepts", () => {
    const prompt = buildTriagePrompt([issue(1), issue(2)]);

    expect(prompt).toContain("<triage>");
    expect(prompt).toContain("</triage>");
    expect(prompt).toContain("scores");
    expect(prompt).toContain("files");
    expect(prompt).toMatch(/1 \(low\) to 5 \(urgent\)/);
  });

  it("round-trips: a reply in the shape the prompt asks for parses and covers every id", () => {
    // The prompt and the parser are two halves of one contract; this pins them
    // together so rewording one without the other fails here.
    const issues = [issue(1), issue(2)];
    const prompt = buildTriagePrompt(issues);
    const ids = issues.map((i) => i.id);

    const reply = [
      "Here is my assessment.",
      '<triage>{"scores":{"gh-1":4,"gh-2":2},"files":{"gh-1":["src/a.py"],"gh-2":[]}}</triage>',
    ].join("\n");

    const parsed = parseTriageOutput(reply, ids);

    expect(parsed).toBeDefined();
    expect(parsed?.scores).toEqual({ "gh-1": 4, "gh-2": 2 });
    // and the ids the prompt asked about are exactly the ids the parser demands
    for (const id of ids) {
      expect(prompt).toContain(id);
      expect(parsed?.scores[id]).toBeDefined();
    }
  });

  it("emits no issue body beyond the first line, so a log-bearing issue cannot bloat the pass", () => {
    const withLog: NormalizedIssue = {
      id: "gh-9",
      description: "# timeout",
      attachedLog: "Traceback...\n  File \"/home/someone/secret/path.py\"",
      sourceType: "github-issue",
    };

    const prompt = buildTriagePrompt([withLog, issue(2)]);

    expect(prompt).not.toContain("Traceback");
    expect(prompt).not.toContain("/home/someone/secret/path.py");
  });
});
