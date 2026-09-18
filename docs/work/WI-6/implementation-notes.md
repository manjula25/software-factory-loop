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

### T2 — merged-PR dedup (FR-002, slice 2)

- **Dispatched:** 2026-09-18. Size: small-medium. Risk: medium (touches the live
  dedup seam; R3 refactor of `openPrListArgs`; opted-out byte-identity pinned).
  Budget: one leaf session; focused queue+loop vitest + typecheck + full `npm test`.
- **Result:** ACCEPTED. Controller re-ran everything fresh on the final tree:
  focused `src/queue.test.ts` + `src/loop.test.ts` 81/81 exit 0; typecheck exit 0;
  full suite 10 files / 155 tests (147 + 8 new), exit 0. Candidate = working tree
  vs base `5ed4590`; 4 changed paths, all within the allowed set.
- **Mid-task correction (controller, pre-review):** the leaf surfaced that
  `runOverrideIssue` (`--issue N`) checked only `skippedDuplicate` — a
  merged-covered issue would be re-run under the override. FR-002 is not
  queue-mode-only, so the controller extended the task: new `skipped-merged`
  override outcome + CLI message, RED observed first (kind "run" received where
  "skipped-merged" expected). This extension went through the reviews below.
- **Reviews (same identity, sequential):** specification review APPROVED (all four
  acceptance states + override extension verified at the seam; no scope creep
  beyond D8 mechanics; Task-4 `mainRevertsPr` deferral respected); code-quality
  review APPROVED (no standard violations; three non-blocking judgement calls
  below).
- **Conservative decisions:** `MergedPr.number/url` carried now though unused by
  dedup — D8 named them for the Task-4 revert net; reviewers checked and accepted
  this as justified, not speculative. `QueueAcquisitionError` message reworded
  ("listing PRs / fix branches failed") to stay truthful across both listings; no
  test asserted the old text.
- **Follow-ups (non-blocking, recorded):**
  1. Quality nit: duplicated match predicate
     `pr.headRefName === branch || token.test(pr.body)` in `splitQueue`
     (src/queue.ts ~191 and ~198) — extract a `covers` predicate if a third
     state ever appears.
  2. Quality nit: `OPEN_PR_PAGE_LIMIT` now bounds both listings; rename to
     `PR_PAGE_LIMIT` next time the export is touched (avoids churn-only rename
     now).
  3. Known deferral: merged-then-reverted PRs are deduped away until Task 4's
     `mainRevertsPr` guard lands (spec'd, tracked, not a gap at this
     checkpoint).


