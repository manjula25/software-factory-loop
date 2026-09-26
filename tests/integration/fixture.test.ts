/**
 * WI-16 T1 — the fixture is a valid subject before anything builds on it.
 *
 * These are the first tests on the integration surface. They assert about the
 * fixture, not about the harness: no scenario runs until T4.
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { ProjectProfile } from "../../src/loop.js";
import { SUITE_SUMMARY_RE, parsePytestFailures } from "../../src/verify.js";
import {
  FIXTURE_BRANCH,
  FIXTURE_CLONE_DIR,
  FIXTURE_REPO,
  PRODUCTION_IMAGE,
  assertFixtureReady,
  ensureFixtureClone,
  readFixtureFile,
} from "./fixture.js";

/**
 * The guard runs inside each test rather than in a `beforeAll`, so an absent
 * fixture reports three failures carrying the setup instruction — not one failed
 * suite with three skipped tests, which is weaker evidence that the guard works.
 */
function readProfile(): ProjectProfile {
  assertFixtureReady(FIXTURE_REPO);
  return JSON.parse(readFixtureFile(".loop-harness/profile.json")) as ProjectProfile;
}

describe("the disposable integration fixture (WI-16 T1)", () => {
  it("exists on GitHub with the base branch the harness will drive", () => {
    assertFixtureReady(FIXTURE_REPO);
    const view = JSON.parse(
      execFileSync("gh", ["repo", "view", FIXTURE_REPO, "--json", "name,defaultBranchRef"], {
        encoding: "utf8",
      }),
    ) as { name: string; defaultBranchRef: { name: string } };
    expect(view.name).toBe("loop-integration-fixture");
    expect(view.defaultBranchRef.name).toBe(FIXTURE_BRANCH);
  });

  it("carries a profile that is opted in, unnotifiable, and born green", () => {
    const profile = readProfile();
    expect(profile.language).toBe("python");
    expect(profile.autoMerge).toBe(true);
    expect(profile).not.toHaveProperty("notifyHandle");
    expect(profile.baselineFailures).toEqual([]);
  });

  it("has a contract suite that is green in the production image", () => {
    ensureFixtureClone();
    const profile = readProfile();
    // Read the verdict through the harness's own parser, so the fixture is
    // proven not-stale by the same rule the harness applies at preflight
    // (`src/loop.ts:985–992`) rather than by a second, weaker judgement. A red
    // suite makes `execFileSync` throw, which is the failing observation.
    const out = execFileSync(
      "docker",
      [
        "run",
        "--rm",
        // pip must write to system site-packages; the clone is mounted read-only
        // so nothing root-owned lands on the host.
        "--user",
        "0:0",
        "-v",
        `${FIXTURE_CLONE_DIR}:/src:ro`,
        "--entrypoint",
        "bash",
        PRODUCTION_IMAGE,
        "-lc",
        'cp -r /src /work && cd /work && pip install -q -e ".[test]" && pytest -q',
      ],
      { encoding: "utf8" },
    );
    expect(SUITE_SUMMARY_RE.test(out)).toBe(true);
    expect(parsePytestFailures(out)).toEqual([...profile.baselineFailures]);
  });
});