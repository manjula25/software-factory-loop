# WI-14 — Implementation Notes

Controller log for the `implement` loop on branch `worktree-wi-14`
(base `ef8d52e` = main). Plan: `docs/work/WI-14/implementation-plan.md`
(T1–T5). Created when implementation began (T1 dispatch, 2026-09-20).

## Controller ledger

| Task | Size/Risk | Fixed point | Candidate | Reviews | Status |
|---|---|---|---|---|---|
| T1 | medium/medium | ef8d52e | a9f7b4e | spec PASS / quality PASS | **accepted** |
| T2 | small-medium/low | a9f7b4e | 5470a97 | spec PASS / quality PASS (rerun) | **accepted** |

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

RED observed first (3 tests failed: `setIssueLabel` never called; negatives
(c)/(d) green by construction, mirroring T1's guards), then minimal GREEN.
First candidate `69fddac` passed the spec review but the quality review
returned one BLOCKING finding: `ensureHarnessFailedLabel` matched
`/already exists/i` against `error.message` under `stdio: "inherit"` — gh
prints that text to stderr, which inherit keeps out of the thrown error, so
the catch arm was dead code and every gh-sourced run after the first on a
repo would abort at startup (a guaranteed T5 break; the reviewer proved it
empirically with a stub gh). Controller fixed it in `5470a97` by mirroring
`setIssueLabel`'s classifier (stderr piped, regex over message + stderr),
stub-verified both ways before committing. Candidate change invalidated both
review identities; both reran sequentially over `a9f7b4e..5470a97`: spec
PASS, quality PASS (rerun — resolution re-verified empirically by the
reviewer's own stubs). Fresh controller gates at `5470a97`: typecheck exit 0;
focused 152/152 (147 + 5 new); full suite 273/273 (268 + 5 new). Accepted
2026-09-21.

**Implementer interpretations (both reviews judged faithful):** knob naming
`setLabelThrows`/`setLabelThrowsFor` mirroring T1; recording-line literal
`harness-failed label add failed: <msg>` (plan specified shape, not wording);
`ensureHarnessFailedLabel`'s "never fatal" scoped to the already-exists arm —
other create failures rethrow loudly at startup, pre-spend.

**Adjacent findings (follow-ups, not scope):**
- A7: the label is created on the target repo even if the run ends up
  processing zero issues (creation precedes acquisition) — cosmetic.
- A8: a gh outage at run start now aborts the run pre-spend where a
  pre-WI-14 run would have proceeded — deliberate; watch in T5.
- A9 (quality rerun, UNVERIFIED, for T3): `setIssueLabel`'s remove classifier
  matches "not found" broadly, so a genuine issue-not-found error during a
  remove would be swallowed as success. No live surface until T3 calls
  remove — tighten or test when T3 lands.
- A10: with fd 2 piped, genuine create-failure stderr reaches the console
  only via the rethrown error; success-path gh warnings are swallowed
  (accepted cost of the classifier shape).

## T3 — label removal on verified success

Dispatched against fixed point `5470a97`.
