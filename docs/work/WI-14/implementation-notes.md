# WI-14 — Implementation Notes

Controller log for the `implement` loop on branch `worktree-wi-14`
(base `ef8d52e` = main). Plan: `docs/work/WI-14/implementation-plan.md`
(T1–T5). Created when implementation began (T1 dispatch, 2026-09-20).

## Controller ledger

| Task | Size/Risk | Fixed point | Candidate | Reviews | Status |
|---|---|---|---|---|---|
| T1 | medium/medium | ef8d52e | a9f7b4e | spec PASS / quality PASS | **accepted** |
| T2 | small-medium/low | a9f7b4e | 5470a97 | spec PASS / quality PASS (rerun) | **accepted** |
| T3 | small/low | 5470a97 | bb37c0d | spec PASS / quality PASS | superseded by T3b |
| T3b | small/low | 7df0921 | 2d95039 | spec PASS / quality PASS | **accepted** |
| T4 | small/low | 2d95039 | e07584e | docs-accuracy PASS | **accepted** |

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

RED observed first (3 failed / 2 passed: the three positive tests saw
`setIssueLabel` called 0 times; the two negatives were green by construction),
then minimal GREEN. Single helper `clearHarnessFailedLabel` (`src/loop.ts:~781`)
with two call sites: the green PR-opened return (`:1172`) and the canary-green
arm beside `closeIssue`. New `QueueSummary.labelFailures` + `LABEL REMOVE
FAILED` render (mirrors `closeFailures`), and a single-issue stderr line. Fresh
controller gates at `bb37c0d`: typecheck exit 0; focused 157/157 (152 + 5 new);
full suite 278/278 (273 + 5 new). Spec review PASS, quality review PASS.

**Superseded by T3b (below).** The implementer raised — rather than silently
widening — a scope question: the plan's original interpretation note 1 said
removal "rides exactly two outcomes", but four other lane returns are also
literally FR-005's "fix verified and PR delivered" (merger-gate non-proceed,
review-skip, merge-failure, halted-sibling skip), so a label set by an earlier
hard-failed run would linger there permanently (open-PR dedup blocks any later
run, even after a human merges). Both reviews independently read FR-005's
literal text as reaching those sites and judged the narrowing a plan-scope
decision, not an implementation defect; the code's own merge-failure comment
already states the position ("a merge failure is not an issue failure: the fix
IS verified and PR'd"). Put to the owner 2026-09-23; owner chose to widen.
Interpretation note 1 amended in the plan (owner, `7df0921`).

## T3b — removal widened to the verified PR-left returns

RED observed first (5 failed / 157 skipped — all four positive tests saw
`setIssueLabel` called 0 times; the failed-remove test likewise), then minimal
GREEN. Four new call sites in `runSingleIssueLane`: the merger-gate
non-proceed return (`return { ...gate.outcome, ...(await clearHarnessFailedLabel(...)) }`
— one call covers all four gate failure arms, which funnel through
`runVerifiedMergerGate`'s single non-proceed return), the review-skip return,
the `mergePr`-throw return, and the halted-sibling return. T3's two sites
untouched. Fresh controller gates at `2d95039`: typecheck exit 0; focused
162/162 (157 + 5 new); full suite 283/283 (278 + 5 new). Spec review PASS,
quality review PASS (quality ran the T3b block 8× consecutively, 5/5 each — no
flake). Accepted 2026-09-21.

**Test change to note:** the T2 test (d) was retargeted from "`setIssueLabel`
never called" on PR-left arms to "never called with op `add`" — the old
assertion is false by design once FR-005 removes there. Both reviews judged it
a faithful reformulation, not a weakening: what those arms *do* call is pinned
more tightly than before by T3b (b)/(c) (`toHaveBeenCalledTimes(1)` + op
`"remove"`). The quality review diffed the test file's full deleted-line set to
confirm no other pre-existing assertion moved.

**Adjacent findings from the T3b reviews (follow-ups, not scope):**
- A14: T3b's `parkSiblingBehindRevert` test local is a byte-identical copy of
  WI-13 T11's `parkSiblingBehindRevert` (`loop.test.ts:~2547`), not a literal
  reuse (the original is describe-scoped) — ~20 duplicated lines; hoisting one
  shared helper would remove them. Test-only.
- A15: the removal adds a synchronous `gh issue edit` call inside the shared-git
  mutex on 5 of 6 sites (consistent with the pre-existing in-mutex
  `closeIssue`), and on the halted arm it now precedes the abort — a hung `gh`
  would delay the halt. Bounded; same posture as existing wiring; T5 surface.
- A16 (nit): the helper reads `clearHarnessFailedLabel` while the dep op and
  both summary lines say "remove".
- Single-issue-surface PR-left removal-failure test is absent but structurally
  covered (`formatSingleIssueResult` branches on `prUrl` alone) — VERIFIED by
  reading; A12 already records the close×remove ordering gap.

## T4 — docs honesty (FR-006)

Two lines changed, one per file: the CLAUDE.md `src/loop.ts` module-table row
gained the WI-14 escalation clause (taking the row's final-conjunct `and`, with
the WI-13 T11 clause losing it), and the `docs/agents/workflow.md`
`npm run loop` row gained one appended clause. Controller diff inspection
confirmed no other row, heading, or section drifted (`--stat`: 2 files, 1+/1−
each). Per the plan, T4's verification is a diff review; because the risk that
matters for a doc row is OVERCLAIM, the independent check run was a
doc-accuracy review reading every claim against `src/loop.ts` at `e07584e`
rather than the two-axis spec/quality pair — recorded here as a deliberate
deviation, not an omission (docs-only checkpoint, no behavior surface; the plan
specifies diff review for this task).

**Implementer catch worth keeping:** the brief said "merged + canary-green +
issue-closed", but `clearHarnessFailedLabel` is called on the canary-green arm
unconditionally — the best-effort `closeFailure` is recorded separately
(`:1623-1626`) and does not gate the removal. The implementer wrote "the merged
+ canary-green arm with its gh-issue close" instead; the review confirmed that
reading against the code. The brief's phrasing would have overclaimed a coupling
that does not exist.

**Adjacent (non-blocking):** A17 — the `workflow.md` clause "an inline
`@<notifyHandle>` comment when a handle is configured" can be misread as the
comment existing only when a handle is set; the comment posts either way and
only the `@` line is conditional. The CLAUDE.md row states the absent-handle
case correctly. Left as-is (the plan scopes that row to one summary clause);
a four-word tightening is available if ever wanted.

**Adjacent findings from the T3 reviews (follow-ups, not scope):**
- A11: disambiguation between add-failures and remove-failures riding the one
  `escalationLabelFailure` field is by branch, not by type — verified disjoint
  today, but a future post-PR escalation would silently mislabel as a removal.
  WI-11 solved the analogous two-origin problem by splitting fields; a separate
  field or `{op, reason}` record would be more faithful. Latent, not live.
- A12: no test pins the close→remove call order on the canary arm, and no test
  combines a close failure × remove success/failure. Coverage gap, not a defect.
- A13 (wording, folded into T3b): two `setLabelThrows`/`setLabelThrowsFor` JSDoc
  lines still say "label add … failure arm"; the queue collector comment claims
  "only the success paths set this field" (literally false) and calls the PR-left
  shape "both…in-hand" (over-broad).
- A9 status: T2's ledger said "tighten or test when T3 lands" — T3 made the
  broad remove classifier live and did neither, **by controller instruction**
  (the regex is T5's live surface and an unrequested tightening would be scope
  creep). Recorded as a deliberate deferral to T5, not an oversight; the
  consequence is bounded to a stale label with a silent summary on an
  already-verified, delivered success.
