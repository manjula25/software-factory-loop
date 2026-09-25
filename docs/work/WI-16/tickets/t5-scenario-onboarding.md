# T5 — Scenario 2: onboarding against two seeded setups

## What to build

Onboarding, executed against two seeded setups, with the recorded profile's commands **actually
executed** and observed to work.

Onboarding is a **separate entry point** from the loop CLI — `scripts/onboard.ts`, invoked as
`npx tsx scripts/onboard.ts <repoDir> [flags]` — and no test executes it today either. It is driven
here as a **process**, for the same reason FR-001 exists: importing a function and calling it
leaves the wiring unexecuted, which is the gap this work item closes.

Two local fixtures, both git repositories with a `main` branch, both with config files, differing
in documentation:

- **the documented setup** — thorough docs naming an install command and a test command, of which
  **at least one is deliberately false** (it does not execute). Without a false claim the second
  half of the acceptance criteria is untestable;
- **the undocumented setup** — config files only, no docs at all. The harder half to seed honestly.

Each run must produce `.loop-harness/profile.json` whose recorded commands execute in a sandbox.

**A claim that fails execution must never reach the profile.** Onboarding reads no documentation —
the commands arrive on argv, from the operator who read the docs — so the mechanism is
`parseSuiteBaseline` (`src/onboard-profile.ts:29–32`): a command whose output carries no pytest
summary line throws `SuiteDidNotRunError` and no profile is written. The test drives the documented
setup with the false command as its argv value and observes exactly that.

**This scenario uses the production image.** Onboarding hardcodes `imageName: "sandcastle-loop"`
(`scripts/onboard.ts:47`) and has no `--image` flag — and it invokes **no agent at all**, only
`sandbox.exec` of the install and test commands. So no substitution is needed here, the test image
is not used, and FR-003 holds with no change to the entry.

## Blocked by

T3 (the command, the reset and the guard).

## Requirement coverage

FR-007; slice C.

## Acceptance criteria

- [ ] Onboarding run as a process against the documented setup writes a profile whose `installCmd`
      and `testCmd` both execute successfully in a sandbox (`integration run`)
- [ ] Onboarding run as a process against the undocumented setup writes a profile the same way
      (`integration run`)
- [ ] Driven with a documentation claim that does not execute, onboarding writes **no** profile
      (`integration run`, recorded RED)
- [ ] No file under `src/` is changed (`review`, changed-path accounting)

## Evidence boundary

Proves onboarding's real entry runs, that both seeded setups yield a profile whose commands work,
and that a claim failing execution never becomes a recorded fact. Does not cover onboarding against
a third language, its interactive or human-approval paths (FR-007's non-claims), or any agent
behavior — onboarding invokes no agent. Does not prove the docs are *good*: the test plays the
operator who read them, so it proves the commands a reader would take from them execute, not that a
reader would take those commands.

## Status

Ready for planning