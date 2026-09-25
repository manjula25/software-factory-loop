# T1 — The fixture repository and its seed

## What to build

The integration test's target repository exists on GitHub as a **provisioned artifact**, and the
test treats it as an input rather than a side effect. It is a small non-Node target carrying
exactly one seeded bug, a suite that is red on that bug and green nowhere else, a project profile
that lets the harness run against it, and one open issue describing the bug in prose.

Required profile facts (the shape is `ProjectProfile`, `src/loop.ts:67–99`):

- `language`, `installCmd`, `testCmd`, `singleTestCmd` — all three commands must actually execute
  in a sandbox; a profile that merely parses is not a pass.
- `baselineFailures: []` — the suite is red on the seeded bug only.
- `autoMerge: true` — deliberate and load-bearing: the merge chain is part of what FR-006 tests.
  This is the only repository in existence for which that opt-in exists for a test's benefit, and
  the harness's own repo keeps human merge regardless (hard constraint 1).
- **no `notifyHandle`** — FR-009. A red run must not be able to @-mention a real account.
- `confidentialityCleared: true` — a self-authored seed carries no client data, and recording that
  explicitly beats leaving the gate to be tripped or not by accident. The issue body carries no
  attachment URL either way.

The fixture is created **once, by hand, under explicit owner authority**. Creating a GitHub
repository is outward-facing and `specification.md` does not authorize the test to do it: the test
verifies the fixture exists and fails with a setup instruction naming what is missing when it does
not.

Repository name, owner and exact seed content are fixed by `writing-plans`, not here.

## Blocked by

None — can start immediately.

## Requirement coverage

FR-004 (the artifact, not the reset — that is T3); FR-009; slice A.

## Acceptance criteria

- [ ] The fixture repository exists, is reachable by the operator's own GitHub CLI auth, and is
      named in one place the test reads (`integration run`)
- [ ] Its suite runs in the production sandbox image and is red on the seeded bug, with the failure
      set `parsePytestFailures` returns matching the profile's `baselineFailures`
      (`integration run`)
- [ ] Its profile parses as a `ProjectProfile`, carries `autoMerge: true`, and carries no
      `notifyHandle` (`integration run`, plus review of the committed `profile.json`)
- [ ] The open issue describes the seeded bug and does not name the fix (`review`)
- [ ] Pointed at a fixture that does not exist, the test **fails** with an instruction naming what
      is missing — it does not create it (`integration run`, recorded RED)

## Evidence boundary

Proves the fixture is a valid subject and that its profile closes the notification path. Does not
prove the reset (T3), and does not prove any harness behavior — no scenario runs yet. The profile's
`autoMerge` and absent `notifyHandle` are proven as *recorded facts*; that the harness honors them
is T4's evidence, not this ticket's.

## Status

Ready for planning