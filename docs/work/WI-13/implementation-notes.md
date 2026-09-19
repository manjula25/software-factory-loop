# WI-13 Implementation Notes

Plan: `docs/work/WI-13/implementation-plan.md` (post-ponytail @ `61b90e2`).
Worktree: `.claude/worktrees/wi-13`, branch `worktree-wi-13`, base `61b90e2`.
Baseline (pre-T1): `npm run typecheck` exit 0; `npm test` 10 files / 223 tests green.

Controller ledger (one row per task):

| Task | Size/Risk | Fixed point | Candidate | Focused tag | Status |
|---|---|---|---|---|---|
| T1 | small/low | 61b90e2 | 9b0fd4a | `plan-parse` | ACCEPTED — gates green (8/8 focused, 231/231 full, typecheck 0); spec PASS; quality APPROVED (both at 9b0fd4a) |
| T2 | small/low | 2db81d1 | 9ad7654 | `plan-order` | ACCEPTED — gates green (5/5 focused, 236/236 full, typecheck 0); spec PASS; quality APPROVED (both at 9ad7654) |

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
