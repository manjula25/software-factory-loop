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

### T5 — issue closing on merge (FR-008, slice 5)

- **Dispatched:** 2026-09-18. Size: small-medium. Risk: low-medium (additive
  final chain link; no new halt/revert semantics). Budget: one leaf session;
  focused loop vitest + typecheck + full `npm test`.
- **Result:** ACCEPTED. Controller re-ran everything fresh on the final tree:
  focused `src/loop.test.ts` 78/78 exit 0; typecheck exit 0; full suite
  10 files / 181 tests (176 + 5 new), exit 0. Candidate = working tree vs
  base `2597226`; 2 changed paths, all within the allowed set (+204/−3).
- **Reviews (same identity, sequential):** specification review APPROVED
  (FR-008 complete — D3 ordering, source gating, red-path never closes,
  evidence comment, loud-but-non-fatal failure; no scope creep; non-opted
  repos byte-identical); code-quality review APPROVED (no standard
  violations; three minor judgement calls below).
- **Brief extension (controller, upfront):** T4 spec-review follow-up #1
  folded in — `formatSummary`'s MERGED line now ends `(canary: green)`,
  pinned by test (truthful via the invariant that `mergedPrs` only ever
  holds canary-green merges).
- **Leaf deviations (accepted, both reviewed):** (1) `QueueSummary`
  gains `closeFailures` + `ISSUE CLOSE FAILED` lines mirroring the T3
  `mergeFailures` precedent — an outcome-level field alone would be silent
  in queue mode; (2) the pre-existing exact-pin of the MERGED line (T3
  ordering test) updated to the new text, required by the sanctioned
  formatSummary change. Also added: `issueNumberFromUrl` helper (digits-only
  url tail, throws loudly, caught by the best-effort close step) and a
  guarded `issue close failed:` stderr line on the `--issue` override path.
- **Follow-ups (non-blocking, recorded):**
  1. Seam-shape drift: `closeIssue(repoDir, issue, comment)` positional vs
     T4's `commentOnPr({repoDir, prUrl, body})` input-object — `LoopDeps`
     already mixes both; use input-object for the next seam, no churn now.
  2. Error-channel conflation: a `assertNoSecrets` abort inside the close
     try is recorded as `closeFailure` like a gh failure — safe (guard names
     the env key only, close doesn't happen, note is loud), but the operator
     responses differ; a distinguishing catch would be marginally clearer.
  3. CLAUDE.md loop.ts row should mention gh-issue closing — folded into
     T6's docs step (T6 edits that row anyway per plan).
  4. Canary-block extraction note from T4 unchanged (`runCanary()` if
     WI-6 grows further).

### T6 — pre-merge review pass (FR-009 + completes FR-004 ordering, slice 6)

- **Dispatched:** 2026-09-18. Size: medium-large. Risk: elevated (a blocking
  gate inserted into the merge chain; adapter refactor of the triage options).
  Budget: one leaf session for code; the live model exercise (plan step 5)
  controller-owned. Focused queue+loop+boundary vitest + typecheck + full
  `npm test`.
- **Result:** ACCEPTED. Controller re-ran everything fresh on the final tree:
  focused `src/queue.test.ts` + `src/loop.test.ts` +
  `src/sandcastle-adapter.boundary.test.ts` 121/121 exit 0 (boundary file
  byte-unchanged); typecheck exit 0; full suite 10 files / 191 tests
  (181 + 10 new), exit 0. Candidate = working tree vs base `2d2f6cf`; 6
  changed paths, all within the allowed set (+368/−11).
- **Reviews (same identity, sequential):** specification review APPROVED
  (FR-009 + FR-004 ordering verified at the seam; opted-out never invokes the
  reviewer; every non-approve path — wrong, uncertain, unparseable, any thrown
  step — blocks mergePr with the PR left open, skip comment, run continues);
  code-quality review APPROVED (no standard violations; three non-blocking
  judgement calls below).
- **Live exercise (plan step 5, controller-run):** one real bounded review
  call through the production wiring against fixtures PR #15 — details and
  cost in `verification.md`. Verdict `approve`, ~19 s wall.
- **Leaf deviations (accepted, all reviewed):**
  1. `triageRunOptions` kept as a thin delegating export rather than removed —
     `src/sandcastle-adapter.boundary.test.ts:65` calls it and the boundary
     file was untouchable per the brief; spec review judged the delegation
     honors D7's intent (bound defined and asserted once at the factory).
  2. `assertNoSecrets` on the review prompt sits inside the try that maps to
     uncertain (a secret in the diff → uncertain → no merge, guard before the
     API call, guard message names the env key only) — deviates from triage's
     guard-outside-catch precedent; spec review judged it fail-closed and
     safe.
  3. `QueueSummary.reviewSkipped` is a required field → one mechanical edit
     adding `reviewSkipped: []` to the single existing `formatSummary` test
     literal; existing T3/T4/T5 auto-merge tests left green (dep factories
     gained default-approve stubs).
  4. CLAUDE.md loop.ts row updated to name the review pass AND gh-issue
     closing (the sanctioned T5 follow-up).
- **Follow-ups (non-blocking, recorded):**
  1. Spec-review note: no negative test asserts a secret-bearing diff blocks
     the review call (guard-before-runReview ordering is wired but
     unasserted) — fold into the pre-delivery cosmetics batch.
  2. Quality (at threshold): `runSingleIssue` is ~408 lines with a
     triple-nested try/finally chain tail — extract `runPreMergeReview` /
     `runCanary` helpers when next touched.
  3. Quality cosmetic: a named `BoundedRunOptions` type would remove the
     third copy of the inline return shape.
  4. Quality subtlety: a `deleteBranch` throw on an approved verdict converts
     to uncertain (fail-closed, correct) — a one-line comment or assigning
     the verdict outside the inner try would make the intent explicit.
  5. No test asserts `loop/review` branch deletion specifically on the throw
     path.

### T4b — defect fix routed back from T7: syncMain (FR-005/D3)

- **Defect (found live in T7, 2026-09-18):** the plan-D3 literal wiring
  `git fetch origin main:main` throws "refusing to fetch into branch
  'refs/heads/main' checked out at <dir>" in the loop's real configuration —
  target clones sit on main, and git never allows fetching into a checked-out
  ref. Unit tests could not catch it (syncMain is stubbed at the loop seam);
  the live green chain crashed post-merge, leaving an uncanaried merge on
  fixtures main (evidence: `evidence/t7-green-chain.log`, tail; recovered by
  a manual `git revert` + push, which incidentally live-proved the
  `mainRevertsPr` re-queue rule — merged PR #16 reverted → gh-14 eligible
  again).
- **Fix:** exported `syncMainToOrigin(repoDir)` — branch-aware: `git pull
  --ff-only origin main` when main is the current branch, the fetch-ref form
  otherwise; both refuse a divergent main non-zero (loud, pre-canary, D3
  intent). main()'s `syncMain` dep delegates to it. Plan-D3's literal command
  is amended in code with the justification and date (deviation documented,
  not silent).
- **Evidence:** 3 new real-git tests (mkdtemp throwaway repos): checked-out
  main fast-forwards (the case the loop always hits); non-main current
  branch syncs main without switching; divergent main throws. RED carried by
  the two positive tests (`syncMainToOrigin is not a function`); the
  divergence test is vacuous pre-fix (TypeError satisfies toThrow) — noted.
  Controller-fresh: focused 89/89, typecheck 0, full suite 194/194 (191+3).
- **Reviews (same identity, sequential):** specification review APPROVED
  (D3 intent preserved in both branch cases, deviation documented, no scope
  creep — advisories: this notes entry, and an optional divergence test for
  the fetch-ref path); code-quality review APPROVED (minor: triplicated
  upstream-advance preamble in the tests; `.then` style vs the file's
  `async/await` — cosmetic).
- **Follow-ups (non-blocking, recorded):** optional divergence test for the
  non-main fetch-ref path; `advanceUpstream()` test helper if the describe
  grows.



