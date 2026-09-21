# WI-14 — Implementation Notes

Controller log for the `implement` loop on branch `worktree-wi-14`
(base `ef8d52e` = main). Plan: `docs/work/WI-14/implementation-plan.md`
(T1–T5). Created when implementation began (T1 dispatch, 2026-09-20).

## Controller ledger

| Task | Size/Risk | Fixed point | Candidate | Reviews | Status |
|---|---|---|---|---|---|
| T1 | medium/medium | ef8d52e | a9f7b4e | spec PASS / quality PASS | **accepted** |
| T2 | small-medium/low | a9f7b4e | — | — | dispatched |

## T1 — escalation comment on the failure arms

RED observed first (5 tests failed: commentOnIssue never called), then minimal
GREEN. Controller gates re-run fresh at `a9f7b4e`: `npm run typecheck` exit 0;
`npx vitest run src/loop.test.ts` 147/147; `npm test` 268/268 (261 + 7 new).
Spec review: no blocking findings. Quality review: no blocking findings.
Accepted 2026-09-21.

**Documented interpretation (controller-approved):** the plan named only
`escalationCommentFailure`; FR-002 also requires the summary to state the
notify handle is not configured when the escalation posted without one, and the
summary builders see only the outcome — so the implementer added
`LoopOutcome.escalation?: { outcomeClass; notifyHandle? }` as the D6-summary
vehicle. Spec review judged this spec-permissible leaning spec-required.

**Adjacent findings (follow-ups, not scope):**
- A1: the absent-handle predicate is inlined at both render sites (queue FAILED
  line, `formatSingleIssueResult`) — a tiny named predicate would single-source
  the D6 vocabulary.
- A2: in `fail()`, `deleteBranch` (uncaught, pre-existing) runs before the
  escalation — a branch-delete throw skips the comment; acceptable because the
  whole lane outcome is lost on that path anyway.
- A3: escalation guards on `issue.url !== undefined` while `closeIssue` guards
  on `sourceType` — equivalent in practice (only the gh normalizer sets url);
  documented, no action.
- A4: `escalation.outcomeClass` is read by no renderer (derivable from the
  arm); harmless redundancy, candidate for the T2/T3 diff to consume.
- A5: reverted/uncanaried outcomes' non-triggering is pinned by code reading,
  not a test — test gap, not a defect.
- A6 (quality review's UNVERIFIED, settled by plan): the confidentiality-gate
  and nesting-guard arms do not escalate — the grilling D3 family is exactly
  repro/verification/preflight-sandbox; recorded here as the settled reading.

**Test-infra note for T2:** `makeQueueDeps`' `ghJson` mock now passes a
configured issue's `url` through acquisition — T2's label tests need the same
pass-through.

## T2 — harness-failed label add

Dispatched against fixed point `a9f7b4e`.
