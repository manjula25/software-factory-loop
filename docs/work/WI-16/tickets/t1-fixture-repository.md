# T1 — The fixture repository and its seed

## What to build

The integration test's target repository exists on GitHub as a **provisioned artifact**, and the
test treats it as an input rather than a side effect. It is a small non-Node target carrying
exactly one seeded defect, a contract suite that is **green and does not cover it**, a project
profile that lets the harness run against it, and one open issue describing the symptom in prose.

*(Corrected 2026-09-25 by reading the practice fixture. This ticket first said the suite is "red on
that bug"; it is not. `manjula25/loop-fixtures-py` is born **green** with `baselineFailures: []` and
each seeded issue is a latent defect the existing suite does not reach. That is the convention the
harness is built around — a born-red fixture would also make the preflight staleness check
(`src/loop.ts:985–992`) demand a non-empty baseline, for no gain.)*

Required profile facts (the shape is `ProjectProfile`, `src/loop.ts:67–99`):

- `language`, `installCmd`, `testCmd`, `singleTestCmd` — all three commands must actually execute
  in a sandbox; a profile that merely parses is not a pass.
- `baselineFailures: []` — the seed suite is green, so a fresh run must find no failures at all.
- `autoMerge: true` — deliberate and load-bearing: the merge chain is part of what FR-006 tests.
  This is the only repository in existence for which that opt-in exists for a test's benefit, and
  the harness's own repo keeps human merge regardless (hard constraint 1).
- **no `notifyHandle`** — FR-009. A red run must not be able to @-mention a real account. This is
  the one field the fixture deliberately does **not** copy from the practice repo, whose profile
  carries `"notifyHandle": "manjula25"` and is the whole of hazard H2.
- **no `confidentialityCleared`** — matching the practice repo, which omits it too. The field is a
  human assertion about Bitcot's client-data policy; a test fixture should not be asserting it. The
  issue body carries no attachment URL, so the gate is never reached.

One deliberate difference from the practice repo: the fixture **commits** `.loop-harness/profile.json`
— its `.gitignore` does not list `.loop-harness/`, where the practice repo's does. That makes the
profile part of the seed commit, so FR-004's reset restores it by construction and the profile is a
reviewable, versioned artifact rather than untracked local state.

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
- [ ] Its suite runs **green** in the production sandbox image, and the failure set
      `parsePytestFailures` returns is empty and equal to the profile's `baselineFailures` — so the
      fixture is provably not stale before any scenario builds on it (`integration run`)
- [ ] Its profile parses as a `ProjectProfile`, carries `autoMerge: true`, and carries no
      `notifyHandle` (`integration run`, plus review of the committed `profile.json`)
- [ ] The contract suite is green **with the seeded defect present** — the defect is latent, which
      is what makes the reproduction test the thing that proves the fix (`integration run`,
      before/after the fix is T4's evidence)
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