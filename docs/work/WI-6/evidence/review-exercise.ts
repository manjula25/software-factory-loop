/**
 * WI-6 T6 plan step 5 — one live exercise of the pre-merge review pass
 * (FR-009) against the fixtures repo's hand-opened PR. Not product code.
 *
 * Run from the harness worktree root:
 *   npx tsx docs/work/WI-6/evidence/review-exercise.ts
 *
 * Exercises the exact production wiring: fixDiff (git diff main...branch) →
 * buildReviewPrompt → assertNoSecrets → runReview (one bounded call on
 * loop/review) → parseReviewOutput. Prints prompt size, verdict, wall time.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { loadEnv } from "../../../../src/env.js";
import { REVIEW_BRANCH, runReview } from "../../../../src/sandcastle-adapter.js";
import { buildReviewPrompt } from "../../../../src/loop.js";
import { parseReviewOutput } from "../../../../src/queue.js";
import { resolveProvider } from "../../../../src/providers.js";
import { assertNoSecrets } from "../../../../src/assert-no-secrets.js";

const FIXTURES = "/home/bitcot/Documents/projects/loop-fixtures-py";
const FIX_BRANCH = "fix/gh-14";
const IMAGE = "sandcastle-loop";

const harnessRoot = "/home/bitcot/Documents/projects/software-factory-loop"; // untracked .env lives in the main checkout, not the worktree
const env = loadEnv(harnessRoot);
const agent = resolveProvider("claude-via-proxy", env);

const issue = {
  id: "gh-14",
  description: [
    "parse_iso8601: ValueError on fractional-second UTC timestamps ending in Z",
    "",
    "Reproduction:",
    "",
    "```",
    '>>> parse_iso8601("2026-09-11T10:30:00.5Z")',
    "ValueError: time data '2026-09-11T10:30:00.5Z' does not match format '%Y-%m-%dT%H:%M:%SZ'",
    "```",
    "",
    "Any UTC timestamp with fractional seconds before the trailing Z fails. Whole-second Z timestamps and naive timestamps parse fine. Expected: a tz-aware datetime preserving the fractional part.",
  ].join("\n"),
  sourceType: "github-issue" as const,
  url: "https://github.com/manjula25/loop-fixtures-py/issues/14",
};

const diff = execFileSync("git", ["diff", `main...${FIX_BRANCH}`], {
  cwd: FIXTURES,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const prompt = buildReviewPrompt(issue, diff);
assertNoSecrets([prompt], env);
console.log(`prompt: ${prompt.length} chars (diff ${diff.length} chars)`);

const started = Date.now();
let stdout: string;
try {
  stdout = await runReview({
    cwd: FIXTURES,
    prompt,
    imageName: IMAGE,
    agent,
    diff,
  });
} finally {
  // Mirrors the loop's deleteBranch wiring: local branch -D, absent = fine.
  try {
    execFileSync("git", ["branch", "-D", REVIEW_BRANCH], {
      cwd: FIXTURES,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    // already absent — nothing to clean up
  }
}
const wallMs = Date.now() - started;
const verdict = parseReviewOutput(stdout);
console.log(`verdict: ${verdict}`);
console.log(`wall: ${wallMs} ms`);
console.log("--- reviewer stdout (tail) ---");
console.log(stdout.slice(-800));
