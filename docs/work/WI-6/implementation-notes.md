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

### T3 — merge machinery + conditional PR body (FR-003, FR-004 wiring, slice 3)

- **Dispatched:** 2026-09-18. Size: medium. Risk: elevated (tail restructure of
  `runSingleIssue`; PR-body signature change; new `mergePr` dep). Budget: one
  leaf session; focused loop vitest + typecheck + full `npm test`.
- **Result:** ACCEPTED. Controller re-ran everything fresh on the final tree:
  focused `src/loop.test.ts` 61/61 exit 0; typecheck exit 0; full suite 10
  files / 161 tests (155 + 6 new), exit 0. Candidate = working tree vs base
  `14b8c32`; 3 changed paths, all within the allowed set.
- **Reviews (same identity, sequential):** specification review APPROVED
  (FR-003 complete, FR-004 wiring portion complete, D1/D3/D9 conformance,
  opted-out byte-identity, secrets-guard coverage verified at every emit
  point); code-quality review APPROVED (no hard violations; judgement calls
  below).
- **Leaf deviation (accepted):** `buildPrBody`'s `autoMerge` param defaults to
  `false` rather than being required — TS1016 forbids a required parameter
  after optional `attachmentFailures`; the default keeps every existing call
  site byte-identical, pinned by test. Documented in the param's doc comment.
- **Conservative decision (reviewed):** a `mergeFailure` outcome still counts
  as `fixed` in the queue (the fix is verified and PR'd; the PR is real work)
  with its own loud `MERGE FAILED` summary surface — not an issue failure.
  `--issue N` override prints `auto-merge failed: <reason>` (secrets-guarded)
  with exit 0.
- **Semantic note for later tasks:** `merged` on the outcome means "merge
  command succeeded" — NOT "canary green" until T4 lands. No consumer may read
  it as green-on-main before then.
- **Follow-ups (non-blocking, recorded):**
  1. `docs/agents/workflow.md` loop row describes the full auto-merge chain
     (review pass, canary, revert) while T4/T6 are still landing on this
     branch — accurate by delivery time (whole chain lands in this work
     item); re-check the wording at `verification-before-completion`.
  2. `LoopOutcome.branch` still names the (now deleted) fix branch on the
     merged path — no consumer today; revisit if a future consumer checks it
     out.
  3. Hygiene (predates this work item): the override path's
     `Loop finished without a PR` console.error bypasses `assertNoSecrets`;
     route it through the guard alongside the new guarded line.

### T4 — canary, revert, halt, notify (FR-005/006/007, slice 4)

- **Dispatched:** 2026-09-18. Size: medium-large. Risk: elevated (new
  sandbox stage on merged main; revert writes to main; halt semantics).
  Budget: one leaf session; focused loop+queue vitest + typecheck + full
  `npm test`.
- **Result:** ACCEPTED. Controller re-ran everything fresh on the final tree:
  focused `src/loop.test.ts` + `src/queue.test.ts` 102/102 exit 0; typecheck
  exit 0; full suite 10 files / 176 tests (161 + 15 new), exit 0. Candidate =
  working tree vs base `8be5b89`; 5 changed paths, all within the allowed set
  (+605/−15).
- **Reviews (same identity, sequential):** specification review APPROVED
  (no missing FR elements beyond the two minor notes below, no scope creep,
  no wrong semantics — D2 canary-green rule, D4 revert/re-queue, D5 halt
  wiring, D6 notify identity all verified at the seam); code-quality review
  APPROVED (no standard violations; five judgement calls, one optional
  cleanup recorded as follow-up).
- **Leaf deviations (accepted):** (1) `mainRevertsPr` placed on `QueueDeps`
  rather than `LoopDeps` — per the plan's GREEN-step text and its single
  caller; (2) `merged.canaryGreen: true` recorded on green outcomes — a red
  canary reverts instead, so the field is always true when set (documented
  in the field's doc comment; spec-review-sanctioned); (3) one T3 test
  updated in place for the new merged-outcome shape; (4) `RevertedRecord`
  carries both `revertCommit?` and `revertFailure?` (revert-failure still
  halts, still notifies, records the named error).
- **Follow-ups (non-blocking, recorded):**
  1. Spec-review MINOR: green canary result is not visible in summary text —
     `merged.canaryGreen: true` lives on the outcome but `formatSummary`'s
     MERGED line prints id/url/mergeCommit only. Red results are fully
     recorded (`⚠️ REVERTED`). Candidate fix: append `canary: green` to the
     MERGED line; fold into T5 (it touches the same tail) or the cosmetics
     batch.
  2. Spec-review MINOR/ADVISORY: `syncMain` throw (divergent main, git
     failure) propagates uncaught — exit 1 and loud, but no revert/comment/
     REVERTED summary, and an uncanaried merge stays on main. Plan D3
     prescribes throw-on-divergence, so this is a plan/spec tension, not
     silent degradation; surface at `verification-before-completion` or
     fold syncMain failure into the red path. Same class, smaller: a
     canary `close()`/`deleteBranch` throw in the finally also propagates.
  3. Quality optional: `CANARY_RED_SUITE` and `CANARY_RED_QUEUE_SUITE` in
     `src/loop.test.ts` are byte-identical constants — extract one; deferred
     because fixing it would have invalidated both review identities
     (kept per the implement loop's changed-candidate rule).
  4. Quality note: canary block in `runSingleIssue` is ~55 lines inline —
     if WI-6 grows further, `runCanary()` returning `{green, evidence}` is
     the natural extraction point.
  5. From the leaf, to check in T7: whether `mainRevertsPr` should fetch
     origin before reading `git log origin/main` (stale-clone freshness).



