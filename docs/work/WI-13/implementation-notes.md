# WI-13 Implementation Notes

Plan: `docs/work/WI-13/implementation-plan.md` (post-ponytail @ `61b90e2`).
Worktree: `.claude/worktrees/wi-13`, branch `worktree-wi-13`, base `61b90e2`.
Baseline (pre-T1): `npm run typecheck` exit 0; `npm test` 10 files / 223 tests green.

Controller ledger (one row per task):

| Task | Size/Risk | Fixed point | Candidate | Focused tag | Status |
|---|---|---|---|---|---|
| T1 | small/low | 61b90e2 | 9b0fd4a | `plan-parse` | ACCEPTED — gates green (8/8 focused, 231/231 full, typecheck 0); spec PASS; quality APPROVED (both at 9b0fd4a) |
| T2 | small/low | 2db81d1 | 9ad7654 | `plan-order` | ACCEPTED — gates green (5/5 focused, 236/236 full, typecheck 0); spec PASS; quality APPROVED (both at 9ad7654) |
| T3 | small/low | 39eba70 | cca5e53 | `planner-wiring` | ACCEPTED — gates green (4/4 focused, 230/230 full, typecheck 0); spec PASS; quality APPROVED (both at cca5e53) |
| T4 | small/low | 240afcd | 01bc242 | `admission` | ACCEPTED — gates green (5/5 focused, 231/231 full, typecheck 0); spec PASS; quality APPROVED (both at 01bc242) |
| T5 | small/low | 11a078f | f70f4d7 | `waves` | ACCEPTED — gates green (5/5 focused, 236/236 full, typecheck 0); spec PASS; quality APPROVED (both at f70f4d7) |
| T6+T6b | medium/high | 6ec50c5 | aee6c78 | `wave-runner` | ACCEPTED — T6 a7b99c6: spec PASS, quality NEEDS_FIXES (2 critical, 2 important); T6b fix aee6c78: gates green (11/11 focused, 251/251 full +7, typecheck 0, loop 131/131 double-run stable); spec PASS; quality APPROVED (both at aee6c78) |
| T7 | small/low | 7148955 | 9aada27 | boundary file | ACCEPTED — gates green (5/5 boundary focused, 252/252 full +1, typecheck 0); spec PASS; quality APPROVED (both at 9aada27) |
| T8 | medium/high | 9a8132a | 7ebfa5c | `verified-merger` | ACCEPTED — gates green (6/6 + 11/11 focused, 258/258 full +6, typecheck 0, loop 137/137 double-run); spec PASS; quality APPROVED (both at 7ebfa5c) |
| T9 | small/low | 0afa98c | 51a27f7 | (docs inspection) | ACCEPTED — gates green (258/258, typecheck 0, staleness grep clean, source diffs comment-only); spec PASS (11/11 criterion items code-traced); quality APPROVED (both at 51a27f7) |
| T10 | medium/high | 8e6d9a9 | 3e1b6bf | live run | ACCEPTED — attempt 3 green end-to-end (planner graph, 2 concurrent lanes, PRs #33/#34, merges + green canaries, re-plan → gh-31 → PR #35, merge + green canary, summary 3/3, exit 0); attempts 1–2 failures recorded verbatim (env; baseline gate correctly aborting a bad seed); spec PASS at d035ead, re-confirmed PASS at 3e1b6bf after appending the review-recommended errata (attempt-1 exit-code mislabel; diff verified 2-line append, nothing altered); quality N/A — zero source changes, evidence file has no code-quality axis (controller ruling, recorded) |
| T11 | medium/high | bc0400b | 3828c21 | `wave-runner` (l) | ACCEPTED — fix pass for the code-review BLOCKING finding (FR-004 wave-granularity stop-the-line); gates green (12/12 focused incl. corrected (c) and (k), 259/259 full +1, typecheck 0, both re-verified independently by each reviewer); spec PASS; quality APPROVED (both at 3828c21); CLAUDE.md loop.ts row updated in the same commit |

## T1 — Plan output contract: schema + parser

- **Seam:** `parsePlanOutput` exported from `src/queue.ts`; tests in `src/queue.test.ts`.
- **Budgets:** one leaf session; edits + vitest only. **Evidence boundary:** harness-source.
- **Brief:** plan T1 verbatim (PlanValue, PlanOutput Zod schema, unknown-id/self-edge/
  cycle/id-coverage rejection; triage functions NOT deleted — T3 owns that).
- **Controller gate:** inspect diff → focused `npx vitest run src/queue.test.ts -t "plan-parse"`
  → full `npm test` + `npm run typecheck` → commit → spec review → quality review.
- **Spec review (base 61b90e2 → candidate 9b0fd4a): PASS**, zero blocking.
  Judgment call accepted: rejecting a blockedBy KEY not in `ids` is within FR-001's
  "self-inconsistent plan → unusable" boundary (symmetric with unknown edge targets;
  safe direction — reject → degrade → run continues).
- **Adjacent findings ledger (spec review):**
  - A1: extra `priority` keys not in `ids` are accepted (coverage-only check, triage-
    symmetric). Follow-up for T2: `orderFromPlan` must iterate the queue's issues,
    never the plan's priority keys.
  - A2: duplicate blockers within one blockedBy array pass validation — harmless
    (set semantics downstream); noted for completeness.
- **Quality review (same identity 9b0fd4a): APPROVED**, zero critical/important.
  - A3: no acyclic-acceptance test exercising `planHasCycle`'s DONE-memoization
    branch (diamond / converging paths) — guard-rail gap, code correct by
    inspection. Follow-up candidate for a later test-only slice.
  - A4 (taste): numeric `VISITING`/`DONE` sentinels — string-literal states would
    read more idiomatically. Never blocks.

## T2 — Planner prompt + ordering

- **Seam:** `buildPlanPrompt`, `orderFromPlan` exported from `src/queue.ts`; tests in
  `src/queue.test.ts`. **Budgets:** one leaf session. **Evidence boundary:**
  harness-source. Brief: plan T2 + binding A1 (issues-driven iteration).
- **Candidate 9ad7654** (base 2db81d1). Controller gates re-run fresh: focused
  `plan-order` 5/5; full 236/236; typecheck 0.
- **Spec review: PASS** (zero blocking). **Quality review: APPROVED** (zero
  critical/important).
- **Adjacent findings ledger:**
  - A5: `buildPlanPrompt` JSDoc says "same shape as `buildTriagePrompt` above" —
    direction word wrong (defined below), and the reference goes stale when T3
    deletes triage. Fold into T3: rewrite the reference when deleting.
  - A6: contract assertion pins the literal `<plan>` line verbatim (brittle);
    the stronger pattern is a prompt↔parser round-trip test (build the reply the
    prompt asks for, assert `parsePlanOutput` accepts). Follow-up candidate for a
    later test-only pass.
  - A7: shared trailing-number tie fallback (`MAX_SAFE_INTEGER`, sort stability)
    inherited verbatim from `admitIssues` — not new to this diff.

## T3 — Adapter + loop wiring: --triage retires

- **Seam:** queue-runner seam (`runQueue`, `QueueLoopDeps`, argv validation) in
  `src/loop.ts`; adapter exports in `src/sandcastle-adapter.ts`. **Budgets:** one
  leaf session. **Evidence boundary:** harness-source.
- **Candidate cca5e53** (base 39eba70). Controller gates re-run fresh: focused
  `planner-wiring` 4/4; full 230/230 (delta −6: triage tests deleted with their
  subject, planner tests added); typecheck 0.
- **Spec review: PASS** (zero blocking). **Quality review: APPROVED** (zero
  critical; one important = workflow.md still documents `--triage` — T9's scoped
  work, reviewer agrees it rides the docs pass before delivery).
- **Deviations accepted:** (1) `AdmitInput.triage` type inlined after `TriageValue`
  deletion (compiler-forced, behavior untouched); (2) interim admission bridge —
  runQueue pre-ranks via `orderFromPlan`, feeds `plan.priority` as `scores` into
  `admitIssues` with empty files (verified comparator-identical; dissolves in T4);
  (3) warning wording "triage unusable" → "plan unusable" (behavior verbatim);
  (4) queue-level file-overlap test retired with the flag (dead — its only input
  producer is gone; function-level pin remains until T4 deletes the surface).
- **Adjacent findings ledger:**
  - A8: task-number drift — code comments and the plan's own T3 section say
    "T5 dissolves admitIssues" but T4 is what deletes it. Comments die with
    `admitIssues` in T4; no standalone fix needed.
  - A9: `src/onboard-profile.ts` line 5 uses retired `--triage` as its valueless-
    flag example — should switch to a live flag (e.g. `--auto-merge`). Non-binding;
    candidate for T9's docs pass.
  - A10: stale "triage" wording in test scaffolding titles (`queue.test.ts`
    admission describe, `loop.test.ts` cap/triage comment) — deleted with
    `admitIssues` in T4 anyway.
  - Spec adjacents: boundary-test rename was brief-permitted though the plan header
    said "untouched" (brief supersedes); transient T3→T4 window with no same-file
    serialization is planned and closed before delivery; makeQueueDeps' default
    runPlan stub is no longer a no-op (future queue-test reviewers take note).

## T4 — Admission rework: optional ceiling, admitIssues dissolved

- **Seam:** runner seam (`runQueue`, `QueueRunInput`, `main()` argv) in
  `src/loop.ts`; `src/queue.ts` public exports. **Budgets:** one leaf session.
  **Evidence boundary:** harness-source.
- **Candidate 01bc242** (base 240afcd). Controller gates re-run fresh: focused
  `admission` 5/5; full 231/231 (delta +1: −4 admission unit tests, +5 runner
  tests); typecheck 0. Only remaining `admitIssues` mention is the explanatory
  comment at `src/loop.ts:1289`.
- **Spec review: PASS** (zero blocking). **Quality review: APPROVED** (zero
  critical). Spec review ran across a session restart (resumed reviewer); checks
  re-run fresh by both reviewers plus controller.
- **Deviations accepted:** (1) predicted typecheck RED didn't materialize — TS
  accepted `cap: undefined` through the Partial-spread helper; observed RED was
  the runtime plan-line failures (3 of 5 new tests); (2) two new tests were
  pinning tests that passed pre-GREEN (overlap-gone, `--max-issues 1`).
- **Adjacent findings ledger:**
  - A11 (BINDING for T9): `docs/agents/workflow.md:24` now stale on three axes —
    `--triage` (T3), "caps at 3 issues per run" (T4), old triage prose. Same PR
    via T9; controller judgment: not a candidate change (would invalidate both
    reviews over a docs line the plan schedules to T9).
  - A12 (BINDING for T9): CLAUDE.md `src/queue.ts` row still says "capped
    admission, triage parsing"; `src/onboard-profile.ts:5` still uses `--triage`
    as its valueless-flag example (A9) — both T9's file set.
  - A13: `plan: all unblocked` header prints even on degraded/single-issue runs
    where no blocking concept exists yet — wording ambiguity; T5/T6's blocked-by
    lines disambiguate. Leave unless T6 wants to revisit.
  - A14 (taste): `input.cap === undefined` branched three times in six lines; a
    single split would state "the ceiling cuts one ranked list into two" once.
    Style only.
  - A15: unmocked `console.log` plan lines now appear in test output — harmless,
    noted so nobody mistakes noisier output for a regression.

## T5 — Wave scheduling: unblockedAfter

- **Seam:** pure export `unblockedAfter` from `src/queue.ts`; tests in
  `src/queue.test.ts`. **Budgets:** one leaf session. **Evidence boundary:**
  harness-source. `src/loop.ts` untouched (T6 consumes it).
- **Candidate f70f4d7** (base 11a078f). Controller gates re-run fresh: focused
  `waves` 5/5; full 236/236 (delta +5); typecheck 0.
- **Spec review: PASS** (zero blocking). **Quality review: APPROVED** (zero
  critical/important).
- **Deviation accepted (controller's brief was wrong):** instructed test 2
  ("completed={A} yields [B]") was internally incoherent — blocker-free
  uncompleted C must appear. Implementer's repair: `unblockedAfter` also
  excludes ids already in `completed`; tests assert {A} → [B,C] and the
  realistic wave-2 {A,C} → [B]. Spec reviewer adjudicated the exclusion
  LOAD-BEARING: non-opted repos never re-plan (FR-006), the same full order is
  passed every wave, and without exclusion settled issues would be re-attempted
  — a constraint-5 double-spend; on opted-in repos the per-merge re-plan makes
  it a harmless no-op.
- **Adjacent findings ledger:**
  - A16 (BINDING for T6): `unblockedAfter` re-evaluates ALL not-completed
    unblocked issues each call — the runner must track attempted lanes
    separately from the FR-002 completed (merged / PR-settled) set, or a failed
    lane is re-attempted next wave.
  - A17 (BINDING for T6): the ceiling slice must apply per wave against the
    attempted budget (lanes started), or the plan line's "attempted" count
    drifts from actual starts. Blocked-never-attempted issues cost nothing and
    consume no ceiling (FR-005).
  - A18: JSDoc's opted-in/non-opted completed-growth sentence documents T6's
    caller behavior, not this function's contract — most likely sentence to
    drift when T6 lands. Watch in T6's review.
  - A19: the ∅ test's 2-cycle fixture deliberately steps outside the parser's
    guarantee (cycles are rejected upstream) — the fallback is defense-in-depth;
    an optional comment line could say so.
  - Spec adjacents: ∅-case doc phrasing loose (acyclic plans can never yield ∅
    with issues remaining); pretest-hook git-fetch noise is environmental.

## T6 + T6b — Wave runner: concurrent lanes, re-plan, stop-the-line; defect-fix pass

- **Seam:** queue-runner seam (`runQueue` wave loop) + `runSingleIssue`
  concurrency contract; `parsePlanOutput` re-plan validation. Tests in
  `src/loop.test.ts` (`wave-runner`, `planner-wiring`, `admission` rewrites).
  **Budgets:** one leaf session per pass. **Evidence boundary:**
  harness-source (dep-injected mocks; real git contention is T10's).
- **T6 candidate a7b99c6** (base 6ec50c5). Gates: 244/244, typecheck 0.
  **Spec review: PASS** (zero blocking; two rulings proven — see adjacents).
  **Quality review: NEEDS_FIXES** — the work item's first blocking verdict:
  - Critical 1: shared `REVIEW_BRANCH` across concurrent opted-in lanes —
    lane A's deleteBranch lands under lane B's in-flight review → spurious
    `uncertain` → merge skipped.
  - Critical 2: `mergePr`/`syncMainToOrigin`/`revertMerge` unserialized on
    the shared clone → index.lock contention → false "divergent main"
    uncanaried-merge HALT.
  - Important 1: re-plan validated against FULL eligible set rejected every
    compliant re-plan (prompt asks only about remaining).
  - Important 2: ∅-wave fallback unreachable-by-construction for validated
    plans — needs honest framing.
  - Minors: `result.value as` cast; `ranked.filter(!attempted)` computed
    twice; `inRun`-not-refreshed invariant; vestigial mock write.
- **Controller adjudication:** fix NOW (T6b), not folded into Slice 3 — T10's
  live run exercises exactly this window; deferring known criticals into
  future tasks is scope-gaming. Reviewer's one-seam suggestion adopted.
- **T6b candidate aee6c78** (base a7b99c6): `createGitChainLock()` per-run
  promise-chain mutex over the whole opted-in arm (review → merge → canary/
  revert/close), identity default in single-issue mode; `parsePlanOutput`
  optional `edgeIds` (priority vs asked set, edges vs full set, two-arg call
  sites unchanged); ∅-fallback rewritten as invariant guard (proof cited);
  discriminant narrowing replaces the cast; dead mock write deleted; +3 pins
  (mutual exclusion order-agnostic depth probe, compliant-re-plan
  acceptance, abort-prevents-wave-2) + 4 plan-parse split-contract cases.
  Gates fresh: `wave-runner` 11/11, `plan-parse` 12/12, full 251/251 (+7),
  typecheck 0, `src/loop.test.ts` double-run 131/131 stable.
- **T6b spec review: PASS** (zero blocking) — mutex boundary adjudicated
  correct (FR-003 fix-work concurrency intact; canary inside the lock is the
  right reading, FR-011 "sequential verified merges"); re-plan split admits
  nothing unsatisfiable; FR-002 routing byte-unchanged; unreachability proof
  independently re-derived. **T6b quality review: APPROVED** (zero
  critical/important) — lock call-graph verified deadlock-free and
  wedge-free; PLAN_BRANCH cleanup cannot race lanes (post-allSettled);
  discriminant verified cast-free; test (i) verified non-vacuous.
  Sequencing note: the mutex boundary survives T8's gate insertion.
- **Adjacent findings ledger (T6 spec + T6b):**
  - A20 (T6 spec): no direct test pins abort-prevents-wave-2 — CLOSED by
    T6b test (k).
  - A21 (T6 spec): aborted runs still run the final notAdmitted loop —
    outcome arguably fine (blocked lines are informative post-halt); leave.
  - A22 (T6 spec): re-plan skip when nothing remains/budget spent is
    asserted only via runPlan call-count, not a distinct reading test — fine
    at this seam.
  - A23 (T6 spec): substring test-matching on `gh-1` vs `gh-11` (endsWith
    prefix collision) in makeQueueDeps canary dispatch — also raised by the
    T6b implementer; pre-existing, benign for current fixtures; ledger it if
    lane-count grows or fixtures gain gh-1x ids.
  - A24 (T6b quality, carry-over minor): `ranked.filter(!attemptedIds.has)`
    recomputed per wave iteration (loop.ts re-plan gate + ∅-fallback) —
    hoistable to one `remaining` per iteration.
  - A25 (T6b quality, minor): test (i)'s depth probe does not wrap
    `deps.fixDiff` — a future narrowing of the locked section around
    `runReview` alone would evade the probe; wrap fixDiff when that region
    is next touched (T8 is the likely toucher).
  - A26 (T6b quality, minor): test (i)'s 100 ms escape makes the pre-fix
    half timing-dependent (post-fix assertion is timing-free) — cosmetic.
  - A27 (T6b spec): re-plan cycle-through-merged-id is rejected loudly
    (conservative, FR-001-compliant) — evidence boundary, not a defect.
  - A28 (T6b spec): `runSingleIssue` now a two-mode seam (optional
    serializeGitChain param) — consider an options object if a third mode
    appears.

## T7 — Adapter: bounded merger run

- **Seam:** adapter public exports (`MERGER_MAX_ITERATIONS`,
  `mergerRunOptions`, `runMerger`) in `src/sandcastle-adapter.ts`; export
  assertions in `src/sandcastle-adapter.boundary.test.ts` (import-scan
  enforcement byte-identical to base). **Budgets:** one leaf session.
  **Evidence boundary:** harness-source, structural (no model call; the
  behavioral exercise of `runMerger` is T8's via injected deps).
- **Candidate 9aada27** (base 7148955). Controller gates re-run fresh:
  boundary 5/5; full 252/252 (+1); typecheck 0.
- **Spec review: PASS** (zero blocking). **Quality review: APPROVED** (zero
  critical/important).
- **Design decisions accepted:** (1) `boundedRunOptions` widened with
  defaulted `maxIterations = 1` so `MERGER_MAX_ITERATIONS` is the named,
  seam-assertable source of the merger bound — existing call sites
  behavior-identical (spec review adjudicated spec-faithful, not scope
  creep); (2) `mainRef` rides the seam unused by `run()` per the
  `runReview`-`diff` idiom (caller bakes it into the prompt — T8's
  authorship); (3) `branchStrategy` reuses the caller's fix branch (never
  creates), mirroring `runFixRun`.
- **Plan correction applied:** plan text said `TriageRunInput`; current type
  is `PlanRunInput` (T3 rename) — brief directed the current name.
- **Adjacent findings ledger:**
  - A29 (T7 spec+quality, cosmetic): `boundedRunOptions` JSDoc says "Both
    the planning pass and the pre-merge review pass" (now three) and quotes
    `maxIterations: 1` as a literal (now a defaulted param). Candidate for
    T9's honesty pass (file-set expansion: `src/sandcastle-adapter.ts`
    comment-only).
  - A30 (T7 quality, pre-existing but deepened): module header JSDoc still
    says "the three exports (`runFixRun`, `createFixSandbox`, `mergeBack`)"
    — stale since `runPlan`; now six exports. Same T9 candidate as A29.
  - A31 (T7 quality, minor): boundary test skips the cheap
    `options.name === "merger"` assertion — consistent with the plan-pass
    test's same gap; fold in if that file is touched again.
  - A32 (T7 quality, minor): `runMerger`'s anonymous inline return type vs
    house `*Outcome` naming — consider a named `MergerOutcome` when T8
    consumes it.
  - Quality watch: `mainRef` is the file's first seam-field with zero
    downstream read until T8 lands — one eye on T8's diff.

## T8 — Verified-merger gate in the loop

- **Seam:** `LoopDeps` new members (`branchConflictsWithMain`,
  `runMerger`) + `runSingleIssue`'s opted-in chain via vitest
  (`verified-merger` describe, 6 tests). Module-private:
  `verifyInFreshSandbox`, `runVerifiedMergerGate`, `buildMergerPrompt`.
  **Budgets:** one leaf session. **Evidence boundary:** harness-source
  (mocked deps; real `git merge-tree` wiring and adapter `runMerger` are
  T10's live exercise).
- **Candidate 7ebfa5c** (base 9a8132a). Controller gates re-run fresh:
  `verified-merger` 6/6, `wave-runner` 11/11 (mutex pins + A25 hardening),
  full 258/258 (+6), typecheck 0, loop double-run 137/137.
- **Spec review: PASS** (zero blocking; all five implementer judgment calls
  adjudicated acceptable). **Quality review: APPROVED** (zero critical; one
  important, explicitly non-blocking — see A33). Extraction verified
  verbatim against the deleted inline block; the one intended reorder
  (sandbox close before createPr/deleteBranch) matches the preflight's
  established close-then-delete ordering. Probe's exit-code discrimination
  fails SAFE in the dangerous direction (non-0/non-1 rethrows → loud
  mergeFailure; git exits 0 only on clean merge-tree).
- **Judgment calls accepted (spec-adjudicated):** (1) probe throw →
  mergeFailure safe-fallback posture, not harness abort (probe is a git
  read, not verification infrastructure); (2) gate-sandbox teardown failure
  folds first-origin-wins on green, dropped on red; (3) sandbox close
  reordered before createPr/fail() deleteBranch (byte-equivalent outcomes,
  full suite the pin); (4) `mainRef = "main"` mirrors createPr's base
  hardcode; (5) green-arm `{passed: true, newFailures: []}` reconstruction
  provably faithful (`diffVerification` passes only with empty set).
- **Adjacent findings ledger:**
  - A33 (T8 quality, important-non-blocking): probe-throw posture has NO
    test — no throw knob on `branchConflictsWithMain` in makeDeps/
    makeQueueDeps. Code-read confirms it mirrors the tested merger-throw
    posture. Cheap zero-risk follow-up test; deferred to avoid churning
    the accepted candidate (test-only change would invalidate both fresh
    reviews). Fold into any later loop.test.ts touch or the backlog.
  - A34 (T8 spec): on the gate's RED path the re-verification sandbox's own
    teardownFailure is dropped (evidence loss only; verdict stands —
    never-decides-or-erases holds). One guarded spread would fix; same
    deferral rationale as A33.
  - A35 (T8 spec): gate mergeFailure strings embed raw error reasons
    un-guarded at construction — identical pre-existing class as the
    mergePr failure path (loop.ts:892); fixing consistently would touch
    that path too. Ledger, don't fix in isolation.
  - A36 (T8 spec): repo-wide git breakage → probe throws on every opted-in
    lane, each landing mergeFailure posture without FR-003-style
    every-lane→harness-level escalation. Theoretical (createPr fails
    earlier). Ledger.
  - A37 (T8 quality, minor): merge-tree --write-tree needs git ≥ 2.38 —
    older git makes every opted-in PR take the loud safe fallback. T10 must
    confirm host git version. BINDING for T10.
  - A38 (T8 quality, minor): runMerger's {stdout, commits} return unused
    by the gate — contract symmetry, noting only.
  - A39 (T8 quality, minor): makeDeps' mergerResolutionFails applies red
    to ANY fix-branch sandbox after mergerRan flips — correct today, mildly
    brittle if a second gate invocation is ever added (per-id queue variant
    is precise).

## T9 — Docs honesty

- **Seam:** none (documentation). Files: `CLAUDE.md`,
  `docs/agents/workflow.md`, comment-only fixes in
  `src/onboard-profile.ts` (A9/A12) and `src/sandcastle-adapter.ts`
  (A29/A30). **Budgets:** one leaf session. **Evidence boundary:** docs +
  comments; no behavioral claim (the suite green proves only no-change).
- **Candidate 51a27f7** (base 0afa98c). Controller gates fresh: 258/258,
  typecheck 0, staleness grep clean, source diffs comment-only.
- **Spec review: PASS** (11/11 criterion items code-traced; the `--triage`
  retirement error compared byte-for-byte against `parseRetiredFlags`;
  zero overclaims; hard-constraint text untouched). **Quality review:
  APPROVED** (zero critical; two importants both explicitly non-blocking
  taste restructures — see A40/A41).
- **Adjacent findings ledger:**
  - A40 (T9 quality, non-blocking taste): workflow.md loop row has crossed
    into unparseable (~7 semicolon clauses in one table cell). Restructure
    candidate: synopsis + pointer in the cell, semantics as a bulleted
    block below the table. Follow-up, not this PR.
  - A41 (T9 quality, non-blocking taste): CLAUDE.md `src/loop.ts` row is a
    WI-by-WI changelog drifting from lookup purpose. Restructure candidate:
    one-line ownership + compact per-WI surface list below. Follow-up.
  - A42 (T9 quality, minor): the doc's "exactly `--triage was removed — …`"
    quote is the fastest-rotting phrase — attribute the canonical location
    (`src/loop.ts`) or soften "exactly". Similar pre-existing rot vector:
    workflow.md "(9 checks)".
  - A43 (T9 quality, minor, optional): adapter header parenthetical reads
    exhaustive but the file also exports types/constants — "the six
    Sandcastle-touching functions" would close the gap.
  - A44 (T9 spec, adjacent): workflow.md synopsis omits `--image` —
    pre-existing omission, defaults anyway.
  - A45 (T9 implementer, for the owner): CLAUDE.md hard-constraint 5's base
    sentence ("at most the capped number of issues, triaged by priority")
    is stale; the 2026-09-19 amendment below it states current semantics.
    Numbered constraint text is grilling territory — owner may reword in a
    future grilling-amended edit.

## T11 — Fix pass: FR-004 merge-granularity stop-the-line (code-review blocking)

- **Origin:** `docs/work/WI-13/review.md` Spec axis, finding (c)1 (BLOCKING). The wave runner
  raised `QueueAbortedError` only after wave settlement and the mutex-wrapped merge chain
  consulted no run-level state — after lane A's red canary + revert released the lock, sibling
  lane B merged on reverted main deterministically. Test (c) had pinned the weaker behavior as
  correct, which is why the T6/T6b dual reviews passed it.
- **Seam:** queue-runner seam (`runQueue`) in `src/loop.test.ts`; module-private
  `RunHaltSignal` / `createRunHaltSignal` / `neverHaltedSignal` / `harnessLevelFailure` and the
  `runSingleIssue` → `runSingleIssueLane` wrapper split in `src/loop.ts`. **Budgets:** one
  leaf session. **Evidence boundary:** harness-source.
- **Candidate 3828c21** (base bc0400b). RED observed verbatim (mergePr "called 1 times, but
  got 2 times") plus a mutation re-check (pre-fix source restored → (l) and corrected (c) both
  fail). Controller gates re-run fresh: `wave-runner` 12/12, full 259/259 (+1), typecheck 0.
- **Spec review: PASS** (zero blocking; all five fix claims verified in code; the
  early-harness-outcome bound adjudicated within FR-004's letter — the spec's absolute
  no-merge sentence is scoped to red canaries, and a sibling already in-flight merging on
  VALID main matches the abort-after-settle posture). **Quality review: APPROVED** (zero
  critical/important; lock ordering adjudged airtight for the red-canary arm; wrapper split
  verified verbatim-move; tests adjudged deterministic and non-vacuous; "smallest correct
  shape, nothing to ponytail").
- **Adjacent findings ledger:**
  - A48 (T11 quality, minor): the `RunHaltSignal` doc's "no sibling merge is attempted after
    the first harness-level outcome" slightly overclaims the early-failure arm (halt set at
    lane resolution, outside the mutex — a sibling chain already entered can still merge, on
    valid main). One honest comment sentence owed when the file is next touched.
  - A49 (T11 quality, cosmetic): halt first-wins is in completion order; `harnessAbort ??=`
    iterates in wave order — with two harness failures in one wave, a sibling's skip reason
    could cite a different lane id than the abort. Never blocks.
  - A50 (T11 quality, minor): tests (c) and (l) overlap in summary assertions; each pins a
    distinct surface (abort snapshot vs no-merge/no-spend counts); a future editor could
    collapse them.
  - A51 (T11 implementer): test (j)'s `mergeThrowsFor: "fix/gh-2"` knob is now inert (gh-2
    never reaches mergePr post-fix); the test still pins the uncanaried surface but its
    config comment is stale. Same possible staleness in canary-red tests at ~569/(g).
  - A52 (T11 spec, cosmetic): the halt skip reuses `reviewSkip`, so the summary reads
    "REVIEW SKIP gh-2" for a skip that never reached review — message text is unambiguous.
  - A53 (T11 spec, minor): a halted opted-in sibling is not added to `completed` — harmless;
    the abort discards re-plan/blockedBy resolution anyway.

## T10 — Live integration run (user-authorized)

- **Seam:** pipeline integration — the full loop against the seeded fixtures
  repo in local Docker (constraint 6). **User authorization obtained**
  before spend (seeding, model budget, fixtures-repo mutation, merges).
- **Seed (owner-facing identity):** fixtures main `e5c388c` — three latent
  `textops` defects (slugify digit drop; titlecase inner-case collapse;
  tag_url first-word truncation depending on slugify) + issues #29, #30
  (independent), #31 (blocked-by-#29, dependency stated in the body).
  Symptoms verified locally before commit; existing suite unaffected.
- **Attempt 1 (recorded verbatim):** startup failure — worktree lacks the
  untracked `.env`, provider resolver refused. No spend. Restart with the
  main-checkout `.env` exported into the process env (values never echoed).
- **Attempt 2 (recorded verbatim):** the preflight baseline gate aborted
  BOTH lanes — the seeded titlecase bug collided with
  `tests/fixed-issues/test_gh_3.py::test_titlecase_preserves_remaining_casing`.
  THE GATE WORKING AS DESIGNED: the controller had verified the seed against
  `test_textops.py` but not the fixed-issues suite; the harness refused to
  run against a drifted baseline (constraint 4's regression permanence,
  demonstrated live). No fix-agent spend. Owner corrected the seed
  (`9bb828b`: titlecase reverted, bug B re-seeded as word_count hyphen
  split, verified against every existing regression assertion
  programmatically); issue #30 closed with an explanatory comment, #32
  opened.
- **Attempt 3 — GREEN end-to-end** (`docs/work/WI-13/evidence/live-run.log`,
  verbatim): planner graph exactly as seeded (`plan: all unblocked` /
  `attempt gh-29` / `attempt gh-32` / `blocked gh-31 by gh-29`) → two
  concurrent lanes (interleaved `[gh-29]`/`[gh-32]` starts) → PRs #33/#34 →
  gh-29 merge + green canary → gh-32 merge + green canary (the merge chains
  serialized behind the shared-git mutex, as designed) → re-plan
  (`[plan]` again → `plan: attempt gh-31`) → gh-31 lane → PR #35 → merge +
  green canary → issues #29/#32/#31 closed → summary `attempted: 3 (fixed:
  3, failed: 0)`, exit 0. No conflict arose → merger pass not exercised
  live (its seam evidence remains T8's vitest pins; noted as a non-claim).
- **End-state verified on fixtures main:** three squash-merge commits
  (`b34ef7c`/`c773dc4`/`286dc82`), three permanent regression tests
  (`test_gh_29.py`, `test_gh_31.py`, `test_gh_32.py`), all three fixes
  behaviorally confirmed post-pull.
- **Reviews: spec review of the evidence vs FR-011's measurable criteria
  and the plan's expected observation — see below. Quality review N/A**
  (controller ruling, recorded here): T10 changes zero source lines; the
  artifact is an evidence log with no code-quality axis. The ruling would
  NOT stand for a task that changed src/.
- **Adjacent findings ledger:**
  - A46 (T10): the merger gate's conflict path was not exercised live (no
    real conflict arose — the three fixes touched disjoint functions in one
    file and merged cleanly). Live merger evidence remains a non-claim;
    the T8 vitest pins are its only behavioral coverage. Candidate: a
    future live run with deliberately overlapping fixes.
  - A47 (T10): worktrees don't inherit the untracked `.env` — every live
    run from a worktree needs the main-checkout `.env` exported (or a
    symlink). Candidate for workflow.md when it next changes (A40's
    restructure).
