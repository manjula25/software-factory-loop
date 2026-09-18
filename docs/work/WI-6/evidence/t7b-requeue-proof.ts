/**
 * WI-6 T7b — re-queue proof after the REAL-agent canary-red revert (FR-006/D4).
 * Same shape as requeue-proof.ts (T7 step 3), against gh-20 / merged PR #21:
 * real listOpenIssues + splitQueue with the production gh/git wiring, no stubs.
 *
 *   npx tsx docs/work/WI-6/evidence/t7b-requeue-proof.ts
 *
 * Expectation: merged PR #21 covers gh-20 (so without the revert guard it
 * would be skipped-merged), mainRevertsPr says main reverted #21, and
 * splitQueue puts gh-20 back in `eligible`.
 */
import { execFileSync } from "node:child_process";

import { loadEnv } from "../../../../src/env.js";
import {
  listOpenIssues,
  prListArgs,
  realGhJson,
  splitQueue,
  type MergedPr,
  type OpenPr,
} from "../../../../src/queue.js";

const FIXTURES = "/home/bitcot/Documents/projects/loop-fixtures-py";
const GH_REPO = "manjula25/loop-fixtures-py";
const harnessRoot = "/home/bitcot/Documents/projects/software-factory-loop";
const env = loadEnv(harnessRoot);

const deps = {
  env,
  ghJson: realGhJson,
  async listOpenPrs(dir: string) {
    return JSON.parse(realGhJson(prListArgs("open"), dir)) as OpenPr[];
  },
  async listMergedPrs(dir: string) {
    return JSON.parse(realGhJson(prListArgs("merged"), dir)) as MergedPr[];
  },
  async mainRevertsPr({ repoDir, pr }: { repoDir: string; pr: MergedPr }) {
    const subjects = execFileSync("git", ["log", "--format=%s", "origin/main"], {
      cwd: repoDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).split("\n");
    const tag = `(#${pr.number})`;
    return subjects.some((s) => s.startsWith('Revert "') && s.includes(tag));
  },
  async listFixBranches(dir: string) {
    const local = execFileSync("git", ["branch", "--list", "fix/*"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\n")
      .map((line) => line.trim().replace(/^\* ?/, ""))
      .filter(Boolean);
    const remote = execFileSync("git", ["ls-remote", "--heads", "origin", "refs/heads/fix/*"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\n")
      .map((line) => line.trim().split("refs/heads/")[1] ?? "")
      .filter(Boolean);
    return [...new Set([...local, ...remote])];
  },
  async deleteBranch(repoDir: string, branch: string) {
    try {
      execFileSync("git", ["branch", "-D", branch], { cwd: repoDir, stdio: "pipe" });
    } catch {
      // already absent
    }
  },
  async deleteRemoteBranch(repoDir: string, branch: string) {
    try {
      execFileSync("git", ["push", "origin", "--delete", branch], { cwd: repoDir, stdio: "pipe" });
    } catch {
      // already absent on the remote
    }
  },
};

const issues = await listOpenIssues(deps, { repo: GH_REPO });
console.log(`open issues: ${issues.map((i) => i.id).join(", ")}`);

const merged = await deps.listMergedPrs(FIXTURES);
const token = /gh-20/i;
const cover = merged.find((pr) => pr.headRefName === "fix/gh-20" || token.test(pr.body ?? ""));
console.log(
  cover
    ? `merged cover: PR #${cover.number} (${cover.headRefName}) — without the revert guard, gh-20 would be skipped-merged`
    : "NO merged cover found for gh-20 (unexpected)",
);
if (cover) {
  console.log(`mainRevertsPr(#${cover.number}): ${await deps.mainRevertsPr({ repoDir: FIXTURES, pr: cover })}`);
}

const split = await splitQueue(deps, FIXTURES, issues);
console.log(`eligible: ${split.eligible.map((i) => i.id).join(", ") || "(none)"}`);
console.log(`skipped-duplicate: ${split.skippedDuplicate.join(", ") || "(none)"}`);
console.log(`skipped-merged: ${split.skippedMerged.join(", ") || "(none)"}`);
console.log(`stale branches deleted: ${split.staleBranchesDeleted.join(", ") || "(none)"}`);

const ok = split.eligible.some((i) => i.id === "gh-20");
console.log(ok ? "RE-QUEUE PROVEN: gh-20 is eligible again" : "FAILED: gh-20 not re-queued");
process.exitCode = ok ? 0 : 1;
