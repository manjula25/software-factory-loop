# T6 — Scenario 3: profile staleness

## What to build

A fixture whose profile's test command no longer matches the code, driven through the real CLI so
the harness records a **failed verification** and flags the profile for re-onboarding — rather than
reading an errored or zero-test command run as a pass.

The behavior is already implemented (`src/loop.ts:985–1009`); what is missing is the seeded
scenario. **This ticket adds the scenario, not the behavior.** If the scenario shows the implemented
behavior is wrong, that is a finding to record and report — not a licence to fix it inside this work
item (FR-008's boundary).

The fixture seeds the mismatch by making the profile's `testCmd` point at something that no longer
holds: a renamed test directory, a removed file, or a command that exits without running any test.

## Blocked by

T3 (the command, the reset and the guard).

## Requirement coverage

FR-008; slice D.

## Acceptance criteria

- [ ] Driving the real CLI against the stale-profile fixture records a failed verification naming
      re-onboarding, and the run's reported outcome says so (`integration run`)
- [ ] The run does **not** proceed to spend on a fix — no fix branch, no fix commit, no pull
      request reaches the fixture (`integration run` + `gh` read-back)
- [ ] A command run that exits zero while executing **no test** is not read as a pass
      (`integration run`, recorded RED)
- [ ] No file under `src/` is changed (`review`, changed-path accounting)

## Evidence boundary

Proves the staleness path is reached and does not spend. Does not cover every way a profile can go
stale — only the test-command case the PRD names (FR-008's non-claims). Does not prove the
re-onboarding instruction is good advice, only that it is recorded.

## Status

Ready for planning