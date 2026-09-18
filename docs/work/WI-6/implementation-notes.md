# WI-6 Implementation Notes

Controller log for the `implement` loop over `docs/work/WI-6/implementation-plan.md`
(rev `b8ec2a1`, post-ponytail). Baseline recorded fresh at `749b132` and re-verified
at `b8ec2a1` before T1 dispatch: clean tree, `npm run typecheck` exit 0,
`npm test` 10 files / 145 tests passed.

## Checkpoints

### T1 — opt-in flag (FR-001, slice 1)

- **Dispatched:** 2026-09-18. Size: small. Risk: low (additive profile field; pinned
  no-behavior-change elsewhere). Budget: one leaf session; typecheck + focused
  `src/onboard-profile.test.ts` + full `npm test`.
- **Intended candidate:** `--auto-merge` valueless onboarding flag →
  `autoMerge: true` in `ProjectProfile`; absent → key omitted.
- **Result:** ACCEPTED. RED observed by leaf (field-undefined assertion failure,
  focused exit 1) and trusted only after controller re-ran everything fresh on the
  final tree: focused 10/10 exit 0, `npm run typecheck` exit 0, full suite
  10 files / 147 tests (145 baseline + 2 new), exit 0. Candidate = working tree vs
  base `b8ec2a1`; 5 changed paths, all within the allowed set.
- **Reviews (same identity, sequential):** specification review APPROVED (FR-001
  complete, no scope creep, serialization path verified end-to-end); code-quality
  review APPROVED (no documented-standard violations; two non-blocking judgement
  calls below).
- **Leaf deviation:** none. Plan says task commits; controller held the commit until
  after both reviews — per the implement loop, controller commits the checkpoint.
- **Follow-ups (non-blocking, recorded):**
  1. Quality nit: `src/loop.ts` `autoMerge` doc comment "Hand-editable in
     profile.json" vs CLAUDE.md constraint 1 "set only via `--auto-merge` at
     onboarding" — one-word clarification ("by a human, outside the harness")
     would remove the tension. Cosmetic; deferred to the cosmetics batch.
  2. Quality note: two parallel valueless-flag `argv.includes` + spread pairs in
     `src/onboard-profile.ts` — a `valuelessFlag` helper was considered and
     rejected as Speculative Generality at n=2 (reviewer's own conclusion).
     Revisit at n=3.

