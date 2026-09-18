# T1 — Opt-in flag (`--auto-merge` → profile `autoMerge: true`)

## What to build

Onboarding accepts an `--auto-merge` flag. Passed, the written project profile records
`autoMerge: true`; absent, the field is omitted entirely (never written false). The field
is hand-editable afterwards and every profile consumer reads the field rather than
re-deriving it. Repos without the field behave byte-identically to today — no behavior
change anywhere else yet.

## Blocked by

None — can start immediately.

## Requirement coverage

FR-001 (specification.md); slice 1.

## Acceptance criteria

- [ ] Onboarding argv with `--auto-merge` produces a profile containing `autoMerge: true` (`unit`, profile-shaping seam)
- [ ] Onboarding argv without the flag produces a serialized profile with no `autoMerge` key (`unit`)
- [ ] A profile with the field absent (existing onboarded repo) reads as off wherever the profile is read (`unit`)
- [ ] Hand-editing the field in the profile changes what profile readers see — no argv re-derivation (`unit`)

## Evidence boundary

Proves the flag→field→reader path only. Does not prove any merge, canary, review, or
notification behavior — those are T3–T7. Full typecheck + suite remain green.

## Status

Ready for planning
