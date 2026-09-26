/**
 * WI-16 T3 — the scenarios command's own machinery: the reset, the guard, the
 * preconditions, and the smallest real invocation of the harness's CLI entry.
 *
 * Every test opens with the precondition check and runs inside the fixture
 * guard (FR-010); the reset is proven against a HAND-MADE mess — FR-004's
 * killed-run half is T4's. The empty-queue invocation's assertion is about the
 * fixture's state, not the run's success (FR-005 posture).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FIXTURE_CLONE_DIR,
  FIXTURE_REPO,
  GUARD_DIR,
  SEED_COMMIT,
  TEST_IMAGE,
  acquireFixtureGuard,
  assertScenariosPreconditions,
  ensureQueueEmptyLabel,
  releaseFixtureGuard,
  resetFixture,
} from "./fixture-reset.js";
import { ensureFixtureClone } from "../integration/fixture.js";

let guardHeld = false;

afterEach(() => {
  if (guardHeld) {
    releaseFixtureGuard();
    guardHeld = false;
  }
});

function openGuard(): void {
  acquireFixtureGuard();
  guardHeld = true;
}

/** The four properties of a clean fixture (FR-004), as callable assertions. */
function expectFixtureClean(): void {
  const heads = execFileSync("git", ["ls-remote", "--heads", "origin"], {
    cwd: FIXTURE_CLONE_DIR,
    encoding: "utf8",
  })
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => line.replace(/.*refs\/heads\//, "").trim())
    .sort();
  expect(heads).toEqual(["main"]);

  const prs = execFileSync(
    "gh",
    ["pr", "list", "--repo", FIXTURE_REPO, "--state", "open", "--json", "number"],
    { encoding: "utf8" },
  );
  expect(JSON.parse(prs)).toEqual([]);

  const remoteMain = execFileSync("git", ["ls-remote", "origin", "refs/heads/main"], {
    cwd: FIXTURE_CLONE_DIR,
    encoding: "utf8",
  })
    .split("\t")[0]
    ?.trim();
  expect(remoteMain).toBe(SEED_COMMIT);

  const localHead = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: FIXTURE_CLONE_DIR,
    encoding: "utf8",
  }).trim();
  expect(localHead).toBe(SEED_COMMIT);
  const status = execFileSync("git", ["status", "--porcelain"], {
    cwd: FIXTURE_CLONE_DIR,
    encoding: "utf8",
  });
  expect(status.trim()).toBe("");
}

describe("the scenarios command (WI-16 T3)", () => {
  it("resets a hand-mutated fixture: branch gone, PR closed, base at the seed", () => {
    assertScenariosPreconditions();
    openGuard();
    ensureFixtureClone();

    // The hand-made mess: a scratch branch with a junk commit, pushed, with an
    // open PR from it. Authorized by the fixture's purpose (FR-004).
    const scratch = mkdtempSync(join(tmpdir(), "loop-t3-mutate-"));
    try {
      execFileSync("git", ["clone", "--quiet", FIXTURE_CLONE_DIR, scratch]);
      execFileSync("git", ["checkout", "-q", "-b", "t3/hand-mutation"], { cwd: scratch });
      writeFileSync(join(scratch, "T3-MUTATION.txt"), "hand-made mess for the reset test\n");
      execFileSync("git", ["add", "T3-MUTATION.txt"], { cwd: scratch });
      execFileSync(
        "git",
        ["-c", "user.name=T3", "-c", "user.email=t3@invalid", "commit", "-q", "-m", "t3 mutation"],
        { cwd: scratch },
      );
      execFileSync("git", ["push", "-q", "origin", "t3/hand-mutation"], { cwd: scratch });
      execFileSync(
        "gh",
        [
          "pr",
          "create",
          "--repo",
          FIXTURE_REPO,
          "--title",
          "T3 hand mutation",
          "--body",
          "created by the reset test; closed by the reset under test",
          "--base",
          "main",
          "--head",
          "t3/hand-mutation",
        ],
        { cwd: scratch, encoding: "utf8" },
      );
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }

    resetFixture();
    expectFixtureClean();
  });

  it("smallest real invocation: the loop finds no eligible issue and the fixture is unchanged", () => {
    assertScenariosPreconditions();
    openGuard();
    ensureFixtureClone();
    resetFixture();
    ensureQueueEmptyLabel();

    // The real CLI entry as a process (FR-001's shape), with placeholder
    // provider credentials — resolveProvider validates presence only. The
    // label is worn by no issue, so the queue is empty: no planner, no
    // sandbox, no agent pass.
    const run = spawnSync(
      "npm",
      [
        "run",
        "loop",
        "--",
        "--repo",
        FIXTURE_CLONE_DIR,
        "--provider",
        "claude-via-proxy",
        "--label",
        "scenarios-empty-queue",
        "--image",
        TEST_IMAGE,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          CLI_PROXY_API_URL: "https://placeholder.invalid",
          CLI_PROXY_API_TOKEN: "placeholder-not-a-real-credential",
        },
        timeout: 240_000,
      },
    );
    // Observed, not asserted: a clean exit is incidental (FR-005 posture); a
    // non-zero exit is printed for the record, because the assertion below is
    // about the fixture's state, not the run's success.
    if (run.status !== 0) {
      console.log("loop exited non-zero — stdout tail:\n" + (run.stdout ?? "").slice(-2000));
    }

    expectFixtureClean();
  });

  it("the guard refuses while held, naming the holder; a dead holder is stolen", () => {
    assertScenariosPreconditions();

    // A live holder: this very process — alive by construction, no child to
    // reap. The guard must refuse and name it.
    mkdirSync(GUARD_DIR, { recursive: false });
    writeFileSync(
      join(GUARD_DIR, "holder.json"),
      JSON.stringify({
        pid: process.pid,
        command: "planted live holder (this test process)",
        startedAt: new Date().toISOString(),
      }),
    );
    try {
      expect(() => acquireFixtureGuard()).toThrow(/held.*planted live holder/s);
    } finally {
      rmSync(GUARD_DIR, { recursive: true, force: true });
    }

    // A dead holder's lock is stolen, not obeyed forever — this is what lets
    // T4's killed-run → clean-run pair proceed at all.
    const deadPid = spawnSync("true").pid;
    mkdirSync(GUARD_DIR, { recursive: false });
    writeFileSync(
      join(GUARD_DIR, "holder.json"),
      JSON.stringify({
        pid: deadPid,
        command: "true (already exited)",
        startedAt: new Date().toISOString(),
      }),
    );
    try {
      expect(() => acquireFixtureGuard()).not.toThrow();
    } finally {
      releaseFixtureGuard();
    }
  });

  it("a missing precondition is a failure naming it — never a skip or a pass", () => {
    // Docker removed without touching PATH: a DOCKER_HOST no daemon answers.
    const noDocker = { ...process.env, DOCKER_HOST: "unix:///nonexistent-t3.sock" };
    expect(() => assertScenariosPreconditions(noDocker)).toThrow(/docker/i);

    // gh auth removed without touching PATH: an empty GH_CONFIG_DIR has no
    // credentials, so `gh auth status` fails.
    const ghConfig = mkdtempSync(join(tmpdir(), "loop-t3-gh-config-"));
    try {
      const noAuth = { ...process.env, GH_CONFIG_DIR: ghConfig };
      expect(() => assertScenariosPreconditions(noAuth)).toThrow(/gh/i);
    } finally {
      rmSync(ghConfig, { recursive: true, force: true });
    }
  });
});
