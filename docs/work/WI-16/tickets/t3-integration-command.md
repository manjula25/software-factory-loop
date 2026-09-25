# T3 — The integration command, the fixture reset, and the concurrency guard

## What to build

The machinery the three scenarios run inside, delivered and proven before the first scenario lands.

**1. The dedicated command.** The scenarios get their own command on the pipeline-integration
surface — a test configuration and script of their own, not the default gate. The default gate's
character is unchanged: `vitest.config.ts` still includes only `src/**/*.test.ts`, and `npm test`
runs zero scenarios, needs no Docker, no network and no GitHub auth, and stays in seconds
(FR-011). Amending `vitest.config.ts` and `package.json` is in scope; no file under `src/` is
(FR-003).

**2. The reset.** Before each run the fixture is returned to a known state, on **both** the remote
and the local clone: branches other than the base deleted, open pull requests closed, the base
branch reset to the seed commit, the local clone made to match. A failed reset aborts the run
loudly — it never proceeds against an unknown starting state (FR-004).

**3. The guard.** Two runs started at the same time must not interleave against the fixture. Either
the second waits for the first, or it refuses to start with a message naming what is holding the
fixture. Silently running both is not permitted (FR-010).

**4. Precondition failure is a failure.** With Docker, network or `gh` auth absent, the command
**fails**, naming the missing precondition. It does not skip and it does not report a pass. This is
what D2's reversal made plain: the inner loop is no longer the thing that needs Docker, so there is
no tension to trade against (`specification.md`, Clarifications).

T3's own runs are the smallest real invocation: the command acquires the fixture, resets it, finds
no eligible issue, and exits. **The assertion is about the fixture's state, not the run's success**
— a clean exit here is incidental, and nothing in this ticket reads it as a pass (FR-005).

## Blocked by

T1 (the fixture exists), T2 (the agent's entry points are scripts).

## Requirement coverage

FR-004 (reset — completed by T4, see Evidence boundary); FR-010; FR-011; FR-013 (the command-table
row is T8); slice A.

## Acceptance criteria

- [ ] The dedicated command exists and runs the scenarios' test configuration; `npm test` runs none
      of them, and its file and test counts are unchanged (`integration run` + a default-gate run)
- [ ] Hand-mutating the fixture — an extra remote branch and an open pull request — and then
      invoking the command leaves the fixture clean: branch gone, PR closed, base at the seed
      commit, local clone matching (`integration run`)
- [ ] A second invocation started while the first holds the fixture either waits for it or refuses
      with a message naming the holder; the two never interleave (`integration run`)
- [ ] With a precondition removed, the command fails naming it — it does not skip and does not
      report a pass (`integration run`, recorded RED)
- [ ] The delivered diff changes no file under `src/` (`review`, changed-path accounting)

## Evidence boundary

Proves the command is isolated from the default gate, that the reset removes a **hand-made** mess,
and that the guard holds. Does not prove the reset survives a mess a **real run** made — FR-004's
named criterion, the killed-run → clean-run pair, needs a run that actually does work and is
therefore proven in T4. The guard is likewise proven here against runs that do no work; T4 repeats
it against runs that do. Full typecheck and the default suite stay green throughout.

## Status

Ready for planning