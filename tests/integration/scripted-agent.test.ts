/**
 * WI-16 T2 — the scripted-agent image answers the harness's real contract.
 *
 * These tests drive the exported seams (`runFixRun`, `runReview`, the prompt
 * builders, `parseReviewOutput`, `normalizeGitHubIssue`) with the live fixture
 * issue, against the test image whose `claude` entry point is a script. No
 * model is invoked; the agent spec carries no provider registry, so no
 * credential of any kind is required at this layer (D8).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { ProjectProfile } from "../../src/loop.js";
import { buildFixPrompt, buildReviewPrompt } from "../../src/loop.js";
import { normalizeGitHubIssue } from "../../src/issues.js";
import { runFixRun, runReview } from "../../src/sandcastle-adapter.js";
import { parseReviewOutput } from "../../src/queue.js";
import {
  FIXTURE_CLONE_DIR,
  FIXTURE_REPO,
  TEST_IMAGE,
  assertFixtureReady,
  assertImageBuilt,
  ensureFixtureClone,
  readFixtureFile,
} from "./fixture.js";

/** The loop identity commits in the target repo must carry (`src/loop.ts`). */
const LOOP_IDENTITY = "software-factory-loop <manjula25+loop@users.noreply.github.com>";

/** No provider registry: nothing resolves a credential, so none is needed. */
const SCRIPTED_AGENT = { engine: "claude-code", model: "scripted-agent" } as const;

const scratchDirs: string[] = [];

/** A private scratch clone per test — branches never touch a shared directory. */
function scratchClone(): string {
  const dir = mkdtempSync(join(tmpdir(), "loop-t2-scratch-"));
  scratchDirs.push(dir);
  execFileSync("git", ["clone", "--quiet", FIXTURE_CLONE_DIR, dir]);
  return dir;
}

function liveIssue() {
  const raw = execFileSync(
    "gh",
    ["issue", "view", "1", "--repo", FIXTURE_REPO, "--json", "number,title,body,url"],
    { encoding: "utf8" },
  );
  return normalizeGitHubIssue(JSON.parse(raw));
}

function readProfile(): ProjectProfile {
  assertFixtureReady(FIXTURE_REPO);
  return JSON.parse(readFixtureFile(".loop-harness/profile.json")) as ProjectProfile;
}

afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

describe("the scripted agent (WI-16 T2)", () => {
  it("fix pass: patch, reproduction test and evidence land on fix/gh-1", async () => {
    assertFixtureReady(FIXTURE_REPO);
    assertImageBuilt(TEST_IMAGE);
    ensureFixtureClone();
    const scratch = scratchClone();
    const issue = liveIssue();
    const profile = readProfile();

    const outcome = await runFixRun({
      cwd: scratch,
      prompt: buildFixPrompt(issue, profile),
      imageName: TEST_IMAGE,
      agent: SCRIPTED_AGENT,
      branch: "fix/gh-1",
      name: "t2-fix",
    });

    expect(outcome.branch).toBe("fix/gh-1");
    expect(outcome.commits.length).toBeGreaterThanOrEqual(1);
    expect(outcome.stdout).toContain("<red-evidence>");
    expect(outcome.stdout).toContain("<green-evidence>");

    // Branch content: exactly the reproduction test and the patched source.
    const changed = execFileSync(
      "git",
      ["diff", "--name-only", "main...fix/gh-1"],
      { cwd: scratch, encoding: "utf8" },
    )
      .split("\n")
      .filter((line) => line !== "")
      .sort();
    expect(changed).toEqual(["src/loopsample/textops.py", "tests/fixed-issues/test_gh_1.py"]);

    // The commit is authored by the loop identity, not by a human.
    const author = execFileSync(
      "git",
      ["log", "-1", "--format=%an <%ae>", "fix/gh-1"],
      { cwd: scratch, encoding: "utf8" },
    ).trim();
    expect(author).toBe(LOOP_IDENTITY);
  });

  it("review pass: the answer satisfies the harness's verdict parser", async () => {
    assertFixtureReady(FIXTURE_REPO);
    assertImageBuilt(TEST_IMAGE);
    ensureFixtureClone();
    const scratch = scratchClone();
    const issue = liveIssue();

    // A synthetic diff keeps this test independent of the fix test's branches:
    // the review contract is the prompt shape plus the verdict block, and the
    // scripted review pass judges nothing.
    const stdout = await runReview({
      cwd: scratch,
      prompt: buildReviewPrompt(issue, "<synthetic diff>"),
      imageName: TEST_IMAGE,
      agent: SCRIPTED_AGENT,
      diff: "<synthetic diff>",
    });

    expect(parseReviewOutput(stdout)).toBe("approve");
  });
});
