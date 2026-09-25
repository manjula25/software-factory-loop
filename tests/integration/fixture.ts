/**
 * WI-16 T1 — the disposable integration fixture, named in exactly one place.
 *
 * The fixture is provisioned once, by hand, under owner authority (see
 * `docs/work/WI-16/implementation-plan.md`, T1.3). No test creates it: creating
 * a GitHub repository is outward-facing, and a test that makes its own target
 * cannot tell a missing fixture from a working one.
 */
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The disposable fixture. NOT `loop-fixtures-py` — that one is the practice repo. */
export const FIXTURE_REPO = "manjula25/loop-integration-fixture";

/** The fixture's base branch. */
export const FIXTURE_BRANCH = "main";

/** Where the test keeps its clone. Under tmpdir: this is scratch, not source. */
export const FIXTURE_CLONE_DIR = join(tmpdir(), "loop-integration-fixture");

/** The production image. T1 checks the seed here; the scenarios pass their own (T2). */
export const PRODUCTION_IMAGE = "sandcastle-loop";

/** Thrown when the fixture is absent or unreachable, always with the setup instruction. */
export class FixtureMissingError extends Error {
  constructor(repo: string, detail: string) {
    super(
      `integration fixture ${repo} is missing or unreachable (${detail}). ` +
        `Provision it once, under owner authority, per ` +
        `docs/work/WI-16/implementation-plan.md T1.3. This test never creates it.`,
    );
    this.name = "FixtureMissingError";
  }
}

/** The single guard. Everything else in this directory runs behind it. */
export function assertFixtureReady(repo: string = FIXTURE_REPO): void {
  try {
    execFileSync("gh", ["repo", "view", repo, "--json", "name"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new FixtureMissingError(repo, error instanceof Error ? error.message : String(error));
  }
}

/** Read a fixture file from the remote, so a check need not depend on a local clone. */
export function readFixtureFile(path: string, repo: string = FIXTURE_REPO): string {
  return execFileSync(
    "gh",
    ["api", `repos/${repo}/contents/${path}`, "-H", "Accept: application/vnd.github.raw"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}