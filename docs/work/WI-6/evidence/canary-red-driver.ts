/**
 * WI-6 T7 plan step 2 — the canary-red scenario, live, ZERO LLM spend
 * (FR-005/006/007: post-merge canary → auto-revert → halt → @-notify).
 *
 * Run from the harness worktree root:
 *   npx tsx docs/work/WI-6/evidence/canary-red-driver.ts
 *
 * Scenario (seeded by hand before this driver runs):
 * - fixtures main carries commit A `453801a` — tests/test_contract.py pins the
 *   CURRENT parse_iso8601 behavior (naive input is whole-seconds-only and
 *   raises ValueError on fractional input). Suite green; baseline [] holds.
 * - issue #18 reports the uncovered gap as a user symptom.
 * - fix/gh-18 `95dfa37` is authored from main~1 (pre-A): fractional support
 *   for the naive branch + tests/fixed-issues/test_gh_18.py. On the branch —
 *   which cannot see A — the repro and the whole suite are genuinely green.
 * After the squash-merge, main = A + fix and the contract test contradicts the
 * fix: a failure NO pre-merge step can see, exactly what the canary guards
 * (a base that moved under the verified fix).
 *
 * Stubs (the zero-LLM boundary — everything else is the real production path:
 * real Docker sandboxes for preflight/verification/canary, real git, real gh):
 * - runFixRun → returns the pre-authored branch + authored RED/GREEN evidence
 *   blocks. It stands in for the agent run only; every gate that matters
 *   (constraint 2 — never trust the agent) still executes for real in the
 *   fresh-sandbox verification step.
 * - runReview → "<review>approve</review>". The review pass itself was
 *   live-exercised with a real model call in the T6 step (verification.md).
 * - listFixBranches → []. Acquisition would otherwise classify the pre-authored
 *   fix/gh-18 branch as stale-and-uncovered and delete it before the run; here
 *   the branch stands in for runFixRun's mid-run output.
 * - runTriage → never called (triage: false).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { loadEnv, readEnvFile } from "../../../../src/env.js";
import { createFixSandbox } from "../../../../src/sandcastle-adapter.js";
import {
  QueueAbortedError,
  formatSummary,
  runQueue,
  syncMainToOrigin,
  type ProjectProfile,
  type QueueLoopDeps,
} from "../../../../src/loop.js";
import {
  listOpenIssues,
  prListArgs,
  realGhJson,
  type MergedPr,
  type OpenPr,
} from "../../../../src/queue.js";
import { resolveProvider } from "../../../../src/providers.js";

const FIXTURES = "/home/bitcot/Documents/projects/loop-fixtures-py";
const GH_REPO = "manjula25/loop-fixtures-py";
const IMAGE = "sandcastle-loop";
const BRANCH = "fix/gh-18";

// Untracked .env lives in the main checkout, not the worktree.
const harnessRoot = "/home/bitcot/Documents/projects/software-factory-loop";
const env = loadEnv(harnessRoot);
const guardEnv = readEnvFile(harnessRoot);
const agent = resolveProvider("claude-via-proxy", env);
const profile = JSON.parse(
  readFileSync(join(FIXTURES, ".loop-harness/profile.json"), "utf8"),
) as ProjectProfile;
const sha = execFileSync("git", ["rev-parse", BRANCH], {
  cwd: FIXTURES,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).trim();
console.log(`[canary-red] pre-authored ${BRANCH} @ ${sha}, autoMerge=${String(profile.autoMerge)}`);

// Authored evidence blocks (runFixRun is stubbed; documented above). The
// verification gate re-derives everything it trusts from its own fresh
// sandbox — these strings only reach the PR body.
const RED = `============================= test session starts ==============================
tests/fixed-issues/test_gh_18.py F                                          [100%]
=================================== FAILURES ===================================
________________ test_parse_iso8601_accepts_fractional_seconds_naive ____________
    def test_parse_iso8601_accepts_fractional_seconds_naive():
        """A naive timestamp with fractional seconds (no trailing Z) parses."""
>       result = parse_iso8601("2026-09-11T10:30:00.5")
E       ValueError: time data '2026-09-11T10:30:00.5' does not match format '%Y-%m-%dT%H:%M:%S'
tests/fixed-issues/test_gh_18.py:8: ValueError
=========================== short test summary info ============================
FAILED tests/fixed-issues/test_gh_18.py::test_parse_iso8601_accepts_fractional_seconds_naive - ValueError
1 failed in 0.02s`;
const GREEN = `tests/fixed-issues/test_gh_18.py ..                                         [100%]
2 passed in 0.01s`;
const fixStdout = `fix run (stubbed — see the driver header)\n<red-evidence>\n${RED}\n</red-evidence>\n<green-evidence>\n${GREEN}\n</green-evidence>`;

/** Issue number from the issue url — mirrors main()'s closeIssue wiring. */
const issueNumberFromUrl = (url: string | undefined): string => {
  const last = url?.split("/").filter(Boolean).pop();
  if (last === undefined || !/^\d+$/.test(last)) {
    throw new Error(`cannot derive an issue number from issue url "${url ?? "(none)"}"`);
  }
  return last;
};

// The real production wiring (same implementations as main() in src/loop.ts),
// with only the four documented stubs swapped in.
const deps: QueueLoopDeps = {
  env: guardEnv,
  runFixRun: async () => ({ stdout: fixStdout, commits: [{ sha }], branch: BRANCH }),
  createFixSandbox,
  async deleteBranch(repoDir, branchToDelete) {
    try {
      execFileSync("git", ["branch", "-D", branchToDelete], { cwd: repoDir, stdio: "pipe" });
    } catch {
      // already absent — nothing to clean up
    }
  },
  async pathCommittedOnBranch(repoDir, branch, path) {
    const stdout = execFileSync("git", ["ls-tree", "--name-only", branch, "--", path], {
      cwd: repoDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return stdout.trim().length > 0;
  },
  async createPr({ repoDir: dir, title, body, base, head }) {
    execFileSync("git", ["push", "-u", "origin", head], { cwd: dir, stdio: "inherit" });
    const url = execFileSync(
      "gh",
      ["pr", "create", "--title", title, "--body", body, "--base", base, "--head", head],
      { cwd: dir, encoding: "utf8" },
    ).trim();
    return { url };
  },
  async fixDiff(dir, diffBranch) {
    return execFileSync("git", ["diff", `main...${diffBranch}`], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  },
  runReview: async () => "<review>approve</review>",
  async mergePr({ repoDir: dir, prUrl }) {
    execFileSync("gh", ["pr", "merge", prUrl, "--squash", "--delete-branch"], {
      cwd: dir,
      stdio: "inherit",
    });
    const mergeCommit = execFileSync(
      "gh",
      ["pr", "view", prUrl, "--json", "mergeCommit", "-q", ".mergeCommit.oid"],
      { cwd: dir, encoding: "utf8" },
    ).trim();
    return { mergeCommit };
  },
  async syncMain(dir) {
    syncMainToOrigin(dir);
  },
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
  async commentOnPr({ repoDir: dir, prUrl, body }) {
    execFileSync("gh", ["pr", "comment", prUrl, "--body", body], { cwd: dir, stdio: "inherit" });
  },
  async closeIssue(dir, issueToClose, comment) {
    execFileSync(
      "gh",
      ["issue", "close", issueNumberFromUrl(issueToClose.url), "--comment", comment],
      { cwd: dir, stdio: "inherit" },
    );
  },
  ghJson: realGhJson,
  async listOpenPrs(dir) {
    return JSON.parse(realGhJson(prListArgs("open"), dir)) as OpenPr[];
  },
  async listMergedPrs(dir) {
    return JSON.parse(realGhJson(prListArgs("merged"), dir)) as MergedPr[];
  },
  async mainRevertsPr({ repoDir: dir, pr }) {
    const subjects = execFileSync("git", ["log", "--format=%s", "origin/main"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).split("\n");
    const tag = `(#${pr.number})`;
    return subjects.some((s) => s.startsWith('Revert "') && s.includes(tag));
  },
  listFixBranches: async () => [], // documented stub — see the header
  async deleteRemoteBranch(dir, branch) {
    try {
      execFileSync("git", ["push", "origin", "--delete", branch], { cwd: dir, stdio: "pipe" });
    } catch {
      // already absent on the remote — nothing to clean up
    }
  },
  runTriage: async () => {
    throw new Error("triage is not part of this scenario");
  },
};

console.log(`[canary-red] acquiring the real issue queue from ${GH_REPO}`);
const issues = await listOpenIssues(deps, { repo: GH_REPO });
console.log(`[canary-red] open issues: ${issues.map((i) => i.id).join(", ")}`);

try {
  const summary = await runQueue(
    { ghRepo: GH_REPO, repoDir: FIXTURES, imageName: IMAGE, agent, profile, cap: 3, triage: false },
    deps,
  );
  console.log(formatSummary(summary));
  console.error("[canary-red] UNEXPECTED: the queue completed without the canary-red abort");
  process.exitCode = 1;
} catch (error) {
  if (!(error instanceof QueueAbortedError)) {
    throw error;
  }
  console.log(formatSummary(error.summary));
  console.error(error.message);
  process.exitCode = 1; // the halt the CLI would take
}
