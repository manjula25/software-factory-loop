# WI-13 Implementation Notes

Plan: `docs/work/WI-13/implementation-plan.md` (post-ponytail @ `61b90e2`).
Worktree: `.claude/worktrees/wi-13`, branch `worktree-wi-13`, base `61b90e2`.
Baseline (pre-T1): `npm run typecheck` exit 0; `npm test` 10 files / 223 tests green.

Controller ledger (one row per task):

| Task | Size/Risk | Fixed point | Candidate | Focused tag | Status |
|---|---|---|---|---|---|
| T1 | small/low | 61b90e2 | TBD | `plan-parse` | dispatching |

## T1 — Plan output contract: schema + parser

- **Seam:** `parsePlanOutput` exported from `src/queue.ts`; tests in `src/queue.test.ts`.
- **Budgets:** one leaf session; edits + vitest only. **Evidence boundary:** harness-source.
- **Brief:** plan T1 verbatim (PlanValue, PlanOutput Zod schema, unknown-id/self-edge/
  cycle/id-coverage rejection; triage functions NOT deleted — T3 owns that).
- **Controller gate:** inspect diff → focused `npx vitest run src/queue.test.ts -t "plan-parse"`
  → full `npm test` + `npm run typecheck` → commit → spec review → quality review.
- (findings appended below as they land)
