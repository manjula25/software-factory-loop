# WI-13 Implementation Notes

Plan: `docs/work/WI-13/implementation-plan.md` (post-ponytail @ `61b90e2`).
Worktree: `.claude/worktrees/wi-13`, branch `worktree-wi-13`, base `61b90e2`.
Baseline (pre-T1): `npm run typecheck` exit 0; `npm test` 10 files / 223 tests green.

Controller ledger (one row per task):

| Task | Size/Risk | Fixed point | Candidate | Focused tag | Status |
|---|---|---|---|---|---|
| T1 | small/low | 61b90e2 | 9b0fd4a | `plan-parse` | ACCEPTED — gates green (8/8 focused, 231/231 full, typecheck 0); spec PASS; quality APPROVED (both at 9b0fd4a) |

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
