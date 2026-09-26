# WI-16 Implementation Plan — T3: the scenarios command, the reset, the guard

Ticket: `docs/work/WI-16/tickets/t3-integration-command.md` (status: Ready for planning).
Spec: `specification.md` — **FR-004** (reset; killed-run half is T4's), **FR-010** (concurrency
guard), **FR-011** (own command; default gate unchanged), **FR-013** (command-table row, landed
in T8 — but workflow.md gains the command in this PR per CLAUDE.md's same-PR rule), slice A.
Base: `83fd204` (T2 reviewed; `npm test` 10 files / 287 tests, typecheck exit 0,
`npm run test:integration` 5 passed).

**No file under `src/` is touched.** If any step turns out to need one, that is the
specification's stop condition: report it, do not make it.

---

## Repository facts this plan is built on (verified 2026-09-26)

- `vitest.integration.config.ts` includes `tests/integration/**/*.test.ts` — a `scenarios/`
  directory placed under `tests/integration/` would be picked up by `test:integration` too.
  The scenarios therefore live at **`tests/scenarios/`**, outside that glob.
  `vitest.config.ts` includes only `src/**/*.test.ts` and is not touched (FR-011).
- The CLI entry (`src/loop.ts:2587`) validates argv, then `loadEnv(process.cwd())` (file wins
  over process env — `src/env.ts`), then `resolveProvider` at startup: `claude-via-proxy`
  requires `CLI_PROXY_API_URL` and `CLI_PROXY_API_TOKEN` **present** (values are never
  verified — placeholders pass, `src/providers.ts:69–80`). A subprocess with those two vars
  in its environment needs no `.env` at all.
- `--label` rides `gh issue list --label <name>` (`src/queue.ts:117`). gh **fails** when the
  label does not exist on the repo, so an empty-queue invocation needs a label that exists
  and is worn by no issue. `ensureHarnessFailedLabel` (`src/loop.ts:2998`) already shows the
  repo pattern: create once, catch `/already exists/i`.
- With zero eligible issues: no planner (only when >1, `src/loop.ts:1908`), no sandbox, no
  agent pass — but `ensureHarnessFailedLabel` still creates the `harness-failed` label on
  the target repo at run start. Harmless and idempotent; the reset does not manage labels.
- The seed commit, recorded at T1.3 and read back from the remote:
  `a4348dafa4aa328b908692ed46a1d4ddf9796fd7`. The base branch is `main`; the fixture is
  `manjula25/loop-integration-fixture`; the canonical local clone is
  `join(tmpdir(), "loop-integration-fixture")` (all in `tests/integration/fixture.ts`).
- T2's shared helpers are importable from `tests/integration/fixture.js` — `FIXTURE_REPO`,
  `FIXTURE_BRANCH`, `FIXTURE_CLONE_DIR`, `TEST_IMAGE`, `assertFixtureReady`,
  `assertImageBuilt`, `ensureFixtureClone`. Reuse, don't redeclare.

## Plan-level design decisions (fixed here; leaves do not re-decide)

1. **D1 — the command is `npm run test:scenarios`** → `vitest run --config
   vitest.scenarios.config.ts`, whose `include` is `tests/scenarios/**/*.test.ts`,
   `passWithNoTests: false`, `testTimeout: 300_000` (same bound-not-budget reasoning as the
   integration config). `npm test` is untouched and stays offline/seconds (FR-011).
2. **D2 — the machinery is `tests/scenarios/fixture-reset.ts`**, exporting:
   - `SEED_COMMIT` (the SHA above, one constant);
   - `assertScenariosPreconditions(env?)` — `docker info` (daemon), `gh auth status` (auth),
     `assertFixtureReady()` (network + fixture), `assertImageBuilt(TEST_IMAGE)` (image);
     each failure throws naming the missing precondition. The `env` parameter (default
     `process.env`) exists so a test can remove one precondition from a copy of the
     environment — that is the acceptance criterion's "with a precondition removed";
   - `acquireFixtureGuard()` / `releaseFixtureGuard()` — a lock **directory**
     `join(tmpdir(), "loop-integration-fixture.guard")` (mkdir is atomic on this FS), holding
     a JSON file with `{ pid, command, startedAt }`. Held → **refuse**, message naming the
     holder (pid, command, age). Dead holder (PID not alive via `process.kill(pid, 0)`;
     ESRCH means dead, EPERM means alive-other-user → treat as held) → remove and re-acquire,
     logging the steal. Refusal, not waiting: FR-010 allows either, refusal is provable, and
     a waiting second run would double the wall-clock of every test of the guard;
   - `resetFixture()` — close open PRs (`gh pr list`/`gh pr close`, no `--delete-branch`) →
     delete remote branches other than `main` (`git ls-remote --heads` → `git push origin
     --delete`) → force-push the seed to main (`git push --force <SEED>:refs/heads/main`) →
     local: `fetch --prune`, checkout main, `reset --hard <SEED>`, `clean -fdx`, delete
     local branches other than main → **verify**: remote heads exactly `[main]`, open PRs
     exactly none, `origin/main` == SEED, local `HEAD` == SEED and `status --porcelain`
     empty. Any failed step or failed verification throws `FixtureResetError` — a failed
     reset aborts loudly, never proceeds against an unknown state (FR-004);
   - `ensureQueueEmptyLabel()` — `gh label create scenarios-empty-queue` with the
     already-exists catch, for the empty invocation below.
3. **D3 — T3's tests are `tests/scenarios/command.test.ts`, four of them**, each opening
   with `assertScenariosPreconditions()` (per-test, T1's convention) and running inside the
   guard (`acquireFixtureGuard` in the test, `afterEach` release):
   1. *hand-mutation → reset → clean*: push a scratch branch with a junk commit to the
      remote, open a PR from it, run `resetFixture()`, assert the four clean properties;
   2. *the smallest real invocation*: `resetFixture()`, `ensureQueueEmptyLabel()`, then spawn
      `npm run loop -- --repo <FIXTURE_CLONE_DIR> --provider claude-via-proxy --label
      scenarios-empty-queue --image sandcastle-loop-test` with placeholder provider vars in
      the child env. **Assert the fixture's state** after exit (seed, no branches, no open
      PRs — unchanged by the run), and record the run's own summary line as an observation.
      A clean exit is incidental, not the assertion (FR-005 posture);
   3. *the guard refuses while held*: hand-create the lock with a live holder (a spawned
      `sleep` child's PID), expect `acquireFixtureGuard()` to throw naming that PID/command;
      then kill the child, expect the next acquire to steal the dead lock and succeed;
   4. *precondition failure is failure*: `assertScenariosPreconditions({ ...process.env,
      PATH: <dir without docker> })` throws naming docker (and the analogous gh case).
4. **D4 — the recorded RED for the precondition criterion is a command-level run**: with a
   PATH lacking docker, `npm run test:scenarios` fails (every test's precondition guard
   throws naming docker) — recorded verbatim with its exit code. It does not skip and does
   not pass.
5. **D5 — the guard protects the fixture only** (FR-010's boundary). It is not held by
   `test:integration`, whose tests only read the fixture remote and clone locally; it is not
   a general harness lock.
6. **D6 — issues and labels are not reset.** FR-004 enumerates branches, PRs, base commit,
   local clone — not issues, not labels. A real run closes issue #1 and creates labels;
   whether the reset must reopen the issue is therefore **T4's question to surface**, not
   this plan's silence to inherit. Flagged in What T4 inherits.

## Tasks

### T3.1 — the command surface, born red

**Files:** `vitest.scenarios.config.ts` (new), `package.json` (+`test:scenarios`),
`tests/scenarios/command.test.ts` (new — all four tests, importing `./fixture-reset.js`),
`tests/scenarios/fixture-reset.ts` (new — the born-red stub), `docs/agents/workflow.md`
(the Integration-tests row gains `test:scenarios`; CLAUDE.md's paragraph gains a clause).

**RED:** ~~`npm run test:scenarios` → the file fails to load (`fixture-reset.js` absent) —
all four tests failed.~~ *(Corrected in place 2026-09-26, before the RED run: a missing
module also fails `npm run typecheck` — tsconfig includes `tests/` — and T1/T2 kept every
gate green at RED. The stub exists with every export present and every function throwing
`T3 born-red stub: … not implemented yet`, so the red is on substance.)* `npm run
test:scenarios` → 4/4 tests failed on the stub's throws, `exit=1`. `npm run typecheck`,
`npm test`, and `npm run test:integration` unchanged (rc=0 each). Recorded to
`docs/work/WI-16/evidence/t3-surface-red.log`.

**Commit:** `test(WI-16): the scenarios command, born red on the missing machinery`

### T3.2 — the machinery, first green

**Files:** `tests/scenarios/fixture-reset.ts` (new).

1. GREEN part 1: guard + precondition tests pass (no fixture mutation yet beyond none).
2. GREEN part 2: hand-mutation → reset test passes — mutates the real fixture remote (a
   scratch branch + an open PR) and proves the reset removes exactly that mess.
3. GREEN part 3: the smallest real invocation — observe the loop's zero-issue summary and
   the unchanged fixture.
4. `npm test`, `npm run typecheck`, `npm run test:integration` re-checked, unchanged.

Recorded to `docs/work/WI-16/evidence/t3-command-green.log` (with exit codes).

**Commit:** `build(WI-16): the fixture reset, the concurrency guard, the preconditions`

### T3.3 — planted defects in the reset (the assertions are load-bearing)

Edit `fixture-reset.ts`, run just the scenarios command, revert, re-run — recorded to
`docs/work/WI-16/evidence/t3-planted-defects.log` with per-command exit codes:

1. ~~Drop the `gh pr close` step → the hand-mutation test fails on the open-PR assertion.~~
   *(Corrected in place 2026-09-26, on the evidence of the planted-defect run itself: with
   the close loop skipped the test still PASSED — deleting a PR's head branch on GitHub
   auto-closes the PR, so the open-PR assertion cannot catch this defect alone. The close
   step is retained in the reset as explicit, loud bookkeeping, but the planted defect the
   assertions catch is the branch deletion:)* Drop the remote-branch deletion → the
   hand-mutation test fails on the only-`main` heads assertion.
2. Drop the force-push of the seed → the hand-mutation test fails on the base-commit
   assertion.

Each revert confirmed byte-identical by an empty `git diff` **before** the green re-run.

**Commit:** `test(WI-16): record the reset's planted-defect pairs`

### T3.4 — the recorded RED: precondition failure at command level

With `PATH` stripped of docker: `npm run test:scenarios` → fails, every test naming the
missing precondition. Recorded verbatim with exit code to
`docs/work/WI-16/evidence/t3-precondition-red.log`. (Run before T3.5's records; the
fixture itself is untouched — the failure precedes any reset.)

**Commit:** `test(WI-16): record the command-level precondition RED`

### T3.5 — records

`implementation-notes.md` (append: the facts with pins, the decisions, the deviations);
`verification.md` (extend: T3's claims → commands → outputs; the boundary — hand-made mess,
not a real run's mess; guard proven against no-work runs; FR-004's killed-run half is T4's).

**Commit:** `docs(WI-16): record T3's provenance and its verification record`

---

## What T4 inherits (so it does not re-decide)

- `npm run test:scenarios` as the scenario surface; `resetFixture()`, the guard, the
  precondition check, `SEED_COMMIT`, `ensureQueueEmptyLabel()` — one place each.
- The per-test convention: preconditions → guard → reset → scenario → assertions on real
  outcomes.
- **The open question D6 names:** whether the reset must reopen issue #1 after a real run
  closes it. T4 answers it with evidence, not inheritance.
- The lock-steal behavior is what makes the killed-run → clean-run pair (FR-004) possible
  at all: a killed run dies holding the guard, and the dead-PID steal is what lets the next
  run proceed.

## Risks, stated

- **The reset force-pushes to a public fixture.** Authorized at T1.3 (the fixture exists to
  be mutated, FR-004); the reset only ever moves `main` **back to the seed**.
- **Hand-opening a PR on the fixture** (T3.2's mutation) is outward-facing on a disposable
  repo — same authorization; the PR is closed by the reset under test.
- **`git clean -fdx` on the canonical clone** deletes untracked scratch — the clone is
  scratch by definition (`fixture.ts`), nothing else uses it for storage.
- **The zero-issue run's summary shape** is observed at T3.2, not asserted in advance; if
  the loop's empty-queue path exits non-zero, that is a finding to report, not a test to
  weaken.
- **The lock is machine-local** (tmpdir). FR-010's hazard is same-machine worktrees sharing
  a Docker daemon; a cross-machine collision is out of the guard's stated boundary.

## Non-claims

This plan delivers T3 and nothing else: no scenario fixes an issue (T4), nothing proves the
reset survives a real run's mess (T4's killed-run pair), onboarding is untouched (T5), and
no claim is made about any real model. The empty-queue invocation proves the command's
machinery on the real CLI entry; its clean exit is incidental (FR-005).
