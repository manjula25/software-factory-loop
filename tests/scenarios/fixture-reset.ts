/**
 * WI-16 T3 (FR-004/FR-010): the scenarios' fixture machinery — the clean-state
 * definition (SEED_COMMIT), the precondition check, the concurrency guard, the
 * reset, and the empty-queue label. Nothing here touches `src/` (FR-003).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export { FIXTURE_CLONE_DIR, FIXTURE_REPO, TEST_IMAGE } from "../integration/fixture.js";
import { FIXTURE_CLONE_DIR, FIXTURE_REPO } from "../integration/fixture.js";

/** The one commit origin/main must sit at for any scenario to mean anything. */
export const SEED_COMMIT = "a4348dafa4aa328b908692ed46a1d4ddf9796fd7";

/** The label worn by no issue — `gh issue list --label` fails on unknown
 * labels, so an empty queue needs a label that exists but matches nothing. */
export const EMPTY_QUEUE_LABEL = "scenarios-empty-queue";

/** The guard's lock directory, shared by every process running scenarios. */
export const GUARD_DIR = join(tmpdir(), "loop-integration-fixture.guard");

/** A machinery step that cannot complete is loud, never silent. */
export class FixtureResetError extends Error {
  constructor(step: string, detail: string) {
    super(`scenarios fixture machinery failed at step "${step}": ${detail}`);
    this.name = "FixtureResetError";
  }
}

interface GuardHolder {
  pid: number;
  command: string;
  startedAt: string;
}

function run(
  step: string,
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
  options: { cwd?: string; allow?: (stderr: string) => boolean } = {},
): string {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      env: env ?? process.env,
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const failure = err as { stderr?: string | Buffer; message?: string };
    const stderr =
      typeof failure.stderr === "string" ? failure.stderr : failure.stderr?.toString("utf8") ?? "";
    if (options.allow?.(stderr)) {
      return "";
    }
    throw new FixtureResetError(
      step,
      `${command} ${args.join(" ")} failed: ${stderr.trim() || (failure.message ?? "no output")}`,
    );
  }
}

function isAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but belongs to someone else — alive.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * FR-010's precondition half: docker reachable, gh authenticated. A missing
 * precondition is a failure that names the tool — never a skip or a pass.
 * The optional env override is what lets the tests remove one precondition
 * at a time (DOCKER_HOST to a dead socket, GH_CONFIG_DIR to an empty dir)
 * without touching PATH.
 */
export function assertScenariosPreconditions(env: NodeJS.ProcessEnv = process.env): void {
  run(
    "precondition: docker",
    "docker",
    ["info", "--format", "{{.ServerVersion}}"],
    env,
  );
  run("precondition: gh", "gh", ["auth", "status"], env);
}

/**
 * FR-010's mutual-exclusion half. Acquire is an atomic mkdir; a holder that is
 * still alive refuses the caller by name; a dead holder's lock is stolen —
 * that steal is what lets a run killed mid-flight be followed by a clean run
 * (FR-004's killed-run half, exercised in T4) instead of wedging forever.
 */
export function acquireFixtureGuard(): void {
  try {
    mkdirSync(GUARD_DIR, { recursive: false });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
      throw err;
    }
    // The lock exists — a live holder refuses, anything else (dead pid,
    // missing/corrupt holder file) is stale and gets stolen.
    let holder: GuardHolder | undefined;
    try {
      holder = JSON.parse(readFileSync(join(GUARD_DIR, "holder.json"), "utf8")) as GuardHolder;
    } catch {
      holder = undefined;
    }
    if (holder && isAlive(holder.pid)) {
      throw new Error(
        `fixture guard is held by pid ${holder.pid} (${holder.command}, since ${holder.startedAt}) — ` +
          `another process is using the shared fixture; refusing to run concurrently`,
      );
    }
    rmSync(GUARD_DIR, { recursive: true, force: true });
    mkdirSync(GUARD_DIR, { recursive: false });
  }
  writeFileSync(
    join(GUARD_DIR, "holder.json"),
    JSON.stringify(
      {
        pid: process.pid,
        command: `vitest scenarios (cwd ${process.cwd()})`,
        startedAt: new Date().toISOString(),
      } satisfies GuardHolder,
      null,
      2,
    ),
  );
}

/** Releases the guard — but never another live holder's lock. */
export function releaseFixtureGuard(): void {
  try {
    const holder = JSON.parse(readFileSync(join(GUARD_DIR, "holder.json"), "utf8")) as GuardHolder;
    if (holder.pid !== process.pid && isAlive(holder.pid)) {
      throw new Error(
        `refusing to release the fixture guard: it is held by pid ${holder.pid} (${holder.command}), not this process`,
      );
    }
  } catch (err) {
    // A missing or corrupt holder file is simply removed — the guard is
    // best-effort cleanup, and a stuck lock helps nobody. The refusal above
    // must survive this catch, so it is rethrown by its own marker.
    if (err instanceof Error && err.message.startsWith("refusing to release")) {
      throw err;
    }
  }
  rmSync(GUARD_DIR, { recursive: true, force: true });
}

/**
 * FR-004's reset: whatever a previous (possibly killed) run left behind, the
 * fixture afterwards has exactly four properties — origin's only branch is
 * `main`, no open PR, origin/main sits at SEED_COMMIT, and the local clone is
 * clean at the same commit. Issues and labels are NOT reset (D6 — reopened
 * for T4).
 */
export function resetFixture(): void {
  // 1. Close every open PR (a branch carrying an open PR is not deletable
  //    through every path, and an open PR would fail the clean assertion).
  const openPrs = JSON.parse(
    run("list open PRs", "gh", [
      "pr",
      "list",
      "--repo",
      FIXTURE_REPO,
      "--state",
      "open",
      "--json",
      "number",
    ]) || "[]",
  ) as Array<{ number: number }>;
  for (const pr of openPrs) {
    run("close PR", "gh", ["pr", "close", String(pr.number), "--repo", FIXTURE_REPO]);
  }

  // 2. Delete every remote branch except main.
  const heads = run("list remote heads", "git", ["ls-remote", "--heads", "origin"], undefined, {
    cwd: FIXTURE_CLONE_DIR,
  })
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => line.replace(/.*refs\/heads\//, "").trim());
  for (const head of heads) {
    if (head !== "main") {
      run("delete remote branch", "git", ["push", "origin", "--delete", head], undefined, {
        cwd: FIXTURE_CLONE_DIR,
      });
    }
  }

  // 3. Put origin/main back at the seed, from a local tree that is clean and
  //    on main at the same commit — a killed run may have left detached HEADs,
  //    staged files, or untracked debris, so none of that is trusted.
  run("fetch origin", "git", ["fetch", "--prune", "origin"], undefined, {
    cwd: FIXTURE_CLONE_DIR,
  });
  run("verify seed commit exists", "git", ["cat-file", "-e", `${SEED_COMMIT}^{commit}`], undefined, {
    cwd: FIXTURE_CLONE_DIR,
  });
  run("recreate local main at seed", "git", ["checkout", "-q", "-B", "main", SEED_COMMIT], undefined, {
    cwd: FIXTURE_CLONE_DIR,
  });
  run("discard untracked debris", "git", ["clean", "-fdq"], undefined, { cwd: FIXTURE_CLONE_DIR });
  run("force-push main to seed", "git", ["push", "--force", "origin", "main:main"], undefined, {
    cwd: FIXTURE_CLONE_DIR,
  });

  // 4. Verify the four properties — a reset that claims success without
  //    checking them is a standing claim nobody can trust.
  const remaining = run("verify remote heads", "git", ["ls-remote", "--heads", "origin"], undefined, {
    cwd: FIXTURE_CLONE_DIR,
  })
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => line.replace(/.*refs\/heads\//, "").trim())
    .sort();
  if (remaining.join(",") !== "main") {
    throw new FixtureResetError(
      "verify remote heads",
      `expected only "main", found [${remaining.join(", ")}]`,
    );
  }
  const remoteMain = run("verify origin/main", "git", ["ls-remote", "origin", "refs/heads/main"], undefined, {
    cwd: FIXTURE_CLONE_DIR,
  })
    .split("\t")[0]
    ?.trim();
  if (remoteMain !== SEED_COMMIT) {
    throw new FixtureResetError(
      "verify origin/main",
      `expected ${SEED_COMMIT}, found ${remoteMain ?? "(none)"}`,
    );
  }
  const status = run("verify working tree", "git", ["status", "--porcelain"], undefined, {
    cwd: FIXTURE_CLONE_DIR,
  });
  if (status.trim() !== "") {
    throw new FixtureResetError("verify working tree", `not clean:\n${status}`);
  }
}

/**
 * Creates the empty-queue label if absent. `gh issue list --label` fails on a
 * label that does not exist, so the empty-queue invocation needs one that
 * exists and is worn by no issue. "already exists" is the one forgiven error —
 * the label's presence is the goal, and a second creation attempt proving it
 * is success, not failure.
 */
export function ensureQueueEmptyLabel(): void {
  run("create empty-queue label", "gh", ["label", "create", EMPTY_QUEUE_LABEL, "--repo", FIXTURE_REPO], undefined, {
    allow: (stderr) => stderr.includes("already exists"),
  });
}
