# WI-9 PRD carve-out — live pipeline-integration run on the hardened tree

Derived from `harness-prd-v2.md` (plan of record) and the evidence trail of
WI-1…WI-8. The PRD wins on any disagreement. This is a traceability artifact,
not a new product requirement: the live run exists to close the standing
non-claim every work item since WI-6 has carried.

## Why this work item exists

The harness has never run live, end-to-end, on its current tree. What has run
for real, and when:

- **WI-1** (2026-09-14): single-issue runs against `manjula25/loop-fixtures-py`
  (pre-hardening loop; one confirming run on the then-hardened loop, PR #7).
- **WI-2** (2026-09-15): queue mode live — acquisition, dedup, capped
  admission, triage ranking, file-overlap deferral.
- **WI-4**: onboarding live in Docker (zero LLM).
- **WI-6 T7** (2026-09-18): the full opt-in auto-merge chain live — but with
  `runFixRun` and `runReview` **stubbed** (zero-LLM boundary, documented in
  its driver header).

Never run live: the current hardened tree (`dd7a4d3`, carrying WI-6/7/8) as a
whole, and specifically a run where the **real LLM fix run** executes inside
the full opt-in auto-merge chain (fix → fresh-sandbox verification → pre-merge
diff review → squash-merge → canary → gh-issue close). Each of WI-6, WI-7 and
WI-8's verification records states this as a non-claim. This work item closes
it.

## Scope

### 1. Seed two new bugs sharing a module (zero LLM)

PRD anchor: "Seeded target repo: `manjula25/loop-fixtures-py`" (a small
Python/pytest project standing in for any future project) and PRD "Testing
Decisions" (integration against seeded, known-buggy repos).

Two new buggy functions in one module of `loop-fixtures-py`, committed to its
`main` (bugs dormant: no existing test covers them), plus two GitHub issues
reporting them — each with a clear symptom description, in the WI-1 issue
style. All existing issues are closed and dedup'd, so these two are the run's
entire eligible queue. The profile baseline must still match a fresh suite
run (the new bugs add no failing tests — the suite stays green on `main`).

### 2. One live queue-mode run, real LLM, opt-in auto-merge chain

PRD anchors: hard constraint 1 (the opt-in chain and its compensating
controls — `loop-fixtures-py` is opted in, per its existing profile; the
harness repo itself is not and stays out of this run), constraint 2
(fresh-sandbox verification is the gate, never the agent's word), constraint
5 (budget: exactly the capped run — 2 issues means 2 fix runs + 1 triage
pass, no re-runs beyond the PRD's documented strong-model retry rule), and
constraint 6 (local Docker only).

The run: `npm run loop` on the current tree against `loop-fixtures-py`,
queue mode (default cap 3; 2 eligible). Expected live evidence: triage scores
and ranks the two eligible issues (they share a module — the file-overlap
deferral may defer the second while the first is fixed); real fix runs write
born-red reproduction tests and fixes; the verification gate re-runs the
suite in fresh sandboxes; verified PRs carry RED/GREEN evidence; the pre-merge
diff review approves; squash-merge; canary green on merged main; issues
auto-closed. Durable evidence: the run log captured verbatim, PR URLs, merge
and canary commits, issue end-states, and the fresh-clone final state of
`main` (all repro tests present and green, both fixes present).

### 3. Machinery defects found live are fixed in-loop, TDD, and recorded

Precedent: WI-1's live runs surfaced five real machinery defects (gh JSON
field, secrets-guard scope, container CLI pin, installCmd before verification,
etc.). If the live run surfaces defects in the current tree, each is fixed via
the normal `diagnosing-bugs`/TDD path in this work item and recorded — that is
a success of the run, not a failure of the work item.

## Out of scope (explicit)

- **Failure-path surfaces live**: teardown throws, uncanaried merges, revert
  on red — these need fault injection to trigger deliberately; they stay
  unit-proven (WI-7/WI-8 evidence). A naturally occurring red canary is
  evidence if it happens, not a target.
- Any cloud sandbox spend (constraint 6).
- The cleanup & docs batch, and the WI-7/WI-8 adjacent findings — backlog.
- Any harness behavior change not forced by a defect the live run exposes.
- Client repos, client issue lists, client logs (constraint 3) — the run uses
  only the harness's own synthetic fixtures repo and self-authored issues.

## Success criteria

At delivery: two new seeded issues on `loop-fixtures-py` processed by one live
queue-mode run on the delivered tree — both fixed by the real LLM fix run,
verified in fresh Docker sandboxes, squash-merged through the pre-merge review
+ canary chain with green canaries, and auto-closed on GitHub; triage's
ranking/deferral behavior visible in the captured log; total spend exactly the
planned 2 fix runs + 1 triage pass (+ the PRD's strong-model retry rule only
if an inexplicable failure occurs); the run log and end-states recorded in
`docs/work/WI-9/verification.md`; any machinery defects found fixed TDD and
recorded; the standing pipeline-integration non-claim closed for this tree.
