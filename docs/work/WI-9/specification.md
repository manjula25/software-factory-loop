# Testable Specification — WI-9 (live pipeline-integration run)

## Status

Approved (owner, 2026-09-19 — including both flagged design decisions: a
naturally red canary is chain-success evidence; triage deferral is completed
by a follow-up invocation, total 2 fix runs with one triage pass per
multi-issue invocation)

## Source artifacts

- `docs/work/WI-9/prd.md` (carve-out; PRD of record `harness-prd-v2.md` wins
  on any disagreement)
- `docs/work/WI-9/slices.md` (3 dependency-ordered slices)
- Evidence base: `docs/work/WI-1/verification.md` (the last real-LLM live
  runs, pre-hardening, and the five machinery defects they surfaced),
  `docs/work/WI-2/verification.md` (queue mode live on the old tree),
  `docs/work/WI-6/verification.md` T7 (the opt-in chain live with the LLM
  stubbed — its zero-LLM boundary names exactly what this work item un-stubs),
  and the standing pipeline-integration non-claim in every verification record
  since.

## Functional requirements

### FR-001: Two dormant bugs and their issues are seeded on the fixtures repo

- **Behavior:** Two new buggy functions land in one module of
  `manjula25/loop-fixtures-py`'s `main`, each reported by an open GitHub
  issue in the established WI-1 style (symptom, expected behavior, minimal
  repro; at least one issue carries a messy inline log block so attachment
  discovery is exercised on a real issue body). The bugs are dormant: the
  committed suite on `main` stays green and the profile baseline still
  matches a fresh suite run, so the seeds do not trip the staleness
  preflight.
- **Source traceability:** PRD "Seeded target repo" + "Testing Decisions";
  carve-out scope 1; slice 1.
- **Slice coverage:** 1.
- **Success criteria:** Both issues open on the fixtures repo and constituting
  the entire eligible queue (all pre-existing issues are closed and dedup'd);
  a fresh clean clone of `main` runs the committed suite green with the
  profile-baseline test count; the seeded functions' defects are reproducible
  by hand but not covered by any committed test.
- **Evidence label:** Runtime/external evidence (fixtures repo state via gh,
  fresh-clone suite run, preflight MATCH).
- **Boundary and errors:** Zero LLM spend. No client data (constraint 3) —
  self-authored issues on the harness's own synthetic repo only.
- **Non-claims:** The seed functions are not a language-coverage claim; the
  repo stays the existing Python/pytest fixtures project.

### FR-002: One live run drives the full opt-in chain for both issues

- **Behavior:** The harness's queue mode runs live against the fixtures repo
  on the delivered tree, with the real fix run (no stubs) inside the opted-in
  auto-merge chain. Per issue, the observable chain is: acquisition and dedup
  → triage scoring/ranking (two eligible issues sharing a module) → real fix
  run writing a born-red reproduction test and a fix → fresh-sandbox
  verification gate over the suite baseline → PR carrying RED/GREEN evidence
  → pre-merge diff review approval → squash-merge → post-merge canary green
  on merged main → issue auto-closed. Where triage's file-overlap rule defers
  the second issue, the deferral reason is visible in the run output and the
  issue is processed by a follow-up invocation (see Clarification b).
- **Source traceability:** Hard constraints 1, 2, 6; PRD "Testing Decisions"
  (integration against seeded repos) and implementation decision 3 (provider
  retry rule); carve-out scope 2; slices 2–3.
- **Slice coverage:** 2 (the run), 3 (the record).
- **Success criteria:** Both issues end CLOSED with a squash-merged PR each;
  every PR body carries the verbatim RED/GREEN evidence sections; the merged
  `main`'s fresh-clone state shows both reproduction tests present and green
  and both fixes present; the run log is captured verbatim and shows triage
  ranking (and any deferral reason) and the full chain per issue; end-states
  read back fresh via gh at verification time. A naturally red canary is
  handled per Clarification a.
- **Evidence label:** Runtime/external evidence (live Docker + gh run; the
  verbatim log is the primary artifact).
- **Boundary and errors:** Local Docker only (constraint 6). If a run fails
  inexplicably, the PRD's documented rule applies: one re-run with a strong
  model before the architecture is blamed — the re-run is recorded, not
  silent. The harness repository itself is not opted in and is never the run
  target (constraint 1).
- **Non-claims:** Failure-path surfaces (teardown throws, uncanaried merge,
  revert-on-red) are not deliberately triggered — unit evidence from
  WI-7/WI-8 stands; a naturally occurring one is recorded as evidence, not a
  target. `main()`'s CLI wiring is exercised live but its internal print
  shaping carries no new unit claims.

### FR-003: Spend is exactly the planned budget, visibly

- **Behavior:** Total agent spend across the work item equals the seeded
  issues' fix runs plus one triage pass per invocation with more than one
  eligible issue — no silent API spend beyond that (constraint 5). Any
  strong-model retry under the PRD rule is named in the record with its
  reason.
- **Source traceability:** Hard constraint 5; PRD implementation decision 3;
  carve-out scope 2.
- **Slice coverage:** 2, 3.
- **Success criteria:** The verification record accounts every agent-bearing
  invocation (fix runs, triage passes, any retry) with its trigger; the count
  matches the plan: 2 fix runs total, one triage pass per multi-issue
  invocation, zero unaccounted invocations.
- **Evidence label:** Runtime evidence (run-log accounting cross-checked
  against the record).
- **Boundary and errors:** The capped-admission machinery enforces the per-run
  cap; the work item adds no second re-drive beyond Clarification b's
  follow-up invocation without owner approval.
- **Non-claims:** No cost figures are claimed (proxy accounting is not
  itemized here); the claim is invocation counts.

### FR-004: Machinery defects the live run exposes are fixed in-loop and the standing non-claim is closed

- **Behavior:** Any defect in the current tree that the live run exposes is
  fixed within this work item via the normal TDD path (failing public-seam
  test first) and recorded with its live symptom; the run is then re-driven
  from a clean state. The work item's verification record explicitly closes
  the standing pipeline-integration non-claim for the delivered tree — or,
  if a defect blocks completion, states exactly what remains open and why.
- **Source traceability:** Carve-out scope 3; WI-1 precedent (five defects
  found and fixed live); hard constraint 2 (verification posture: failures
  recorded loudly).
- **Slice coverage:** 2 (defect fixes), 3 (closure).
- **Success criteria:** Each surfaced defect has a committed failing-test
  first, then the fix, then fresh gates (full suite + typecheck green at the
  delivered candidate); `verification.md` states the non-claim closure for
  the delivered tree with the run evidence, or the honest remainder.
- **Evidence label:** Harness-source unit tests at the public seam (defect
  fixes) + runtime/external evidence (the re-driven run).
- **Boundary and errors:** A defect whose fix would change harness behavior
  beyond repair scope goes back through the lifecycle (grilling/spec), not
  silently into this work item.
- **Non-claims:** "No defects exist" is not claimed — only that none remain
  unrecorded.

## Non-functional constraints

- Hard constraints 1–6 (CLAUDE.md) unchanged and actively exercised where
  named: constraint 1's opt-in chain on the fixtures repo only; constraint 2
  fresh-sandbox gates live; constraint 3 respected by self-authored seeds;
  constraint 5's budget in FR-003; constraint 6 local Docker.
- No lint surface exists; none is added. `docs/agents/workflow.md`'s command
  list stays authoritative (the run uses the documented pipeline commands).
- No public-seam signature changes are planned; any defect fix that needs one
  goes back through the lifecycle per FR-004's boundary.

## Clarifications

Two design forks are decided here for approval (same posture as WI-8's two
decisions). Both approved by the owner, 2026-09-19:

(a) **A naturally red canary is chain-success evidence, not a work-item
failure.** If a merge's canary fails on the real repo, the chain's
compensating controls fire (revert, halt, @-notify) and the issue stays open;
the success criterion for that issue becomes "reverted with recorded
evidence," not "merged green." The work item does not re-drive past a
legitimately red canary to force a green merge.

(b) **Deferral means a second invocation, and the budget follows.** Triage's
file-overlap rule defers within a run, so one invocation may fix one issue
and defer the other; the deferred issue is completed by one follow-up
invocation. Total spend stays 2 fix runs; triage passes become one per
multi-issue invocation (amending the carve-out's "1 triage pass" wording —
the amendment is recorded here, not silently). This also proves re-admission
of a deferred issue after its blocker merges. Alternative rejected: seeding
the bugs in separate modules to force both into one invocation — loses the
live deferral evidence.

## Traceability matrix

| FR | Slice | Carve-out section | Key traced source |
|---|---|---|---|
| FR-001 | 1 | 1 | PRD seeded-repo decision; WI-1 issue style |
| FR-002 | 2, 3 | 2 | Hard constraints 1/2/6; WI-6 T7 zero-LLM boundary |
| FR-003 | 2, 3 | 2 | Hard constraint 5; PRD decision 3 |
| FR-004 | 2, 3 | 3 | WI-1 live-defect precedent; constraint 2 |

## Approval

Approved by the owner, 2026-09-19 (both design decisions above included).
Next per the lifecycle: `writing-plans`.
