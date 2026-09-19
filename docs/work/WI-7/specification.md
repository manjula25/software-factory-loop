# Testable Specification — WI-7 (post-WI-6 hardening & cleanup batch)

## Status

Approved (owner, 2026-09-19 — including the FR-002 failure shape: comment +
halt, no blind revert)

## Source artifacts

- `docs/work/WI-7/prd.md` (carve-out; PRD of record `harness-prd-v2.md` wins on
  any disagreement)
- `docs/work/WI-7/slices.md` (4 dependency-ordered slices)
- Evidence base: `docs/work/WI-6/review.md` (two-axis triage),
  `docs/work/WI-6/implementation-notes.md` (per-checkpoint follow-ups),
  `docs/work/WI-6/verification.md` (T4/T4b/T7 findings).

## Functional requirements

### FR-001: Queue decisions read fresh remote state

- **Behavior:** Before any dedup or re-queue judgment consults git-derived
  remote state (merged-PR revert detection, remote fix-branch listing,
  stale-branch cleanup), the target clone's remote refs are refreshed once per
  acquisition (fetch with prune). This applies to queue mode and to the
  single-issue override alike — both run the same dedup.
- **Source traceability:** PRD "Review and merge gate" (revert net) and
  "Dedup / already-in-progress check"; WI-6 spec FR-002/FR-006; WI-6 review
  deferred finding (c)1; WI-6 T4 follow-up #5, T7 follow-up.
- **Slice coverage:** Slice 1.
- **Success criteria:** On a clone whose tracking refs predate a remote revert,
  a reverted issue is admitted as eligible (not skipped-merged); a remotely
  deleted fix branch is not listed after acquisition; both proven by real-git
  seam tests against throwaway repositories.
- **Evidence label:** Harness-source unit/integration (real-git fixtures) at
  the public seam.
- **Boundary and errors:** A failed refresh is a harness-level abort: loud,
  named, exit non-zero, before any sandbox, model call, or PR action. The
  refresh happens once per acquisition, not per issue.
- **Non-claims:** No new dedup signals; no change to what dedup decides, only
  to the freshness of the git state it decides on. GitHub-side queries (open
  and merged PR listings) are already live and unchanged.

### FR-002: A merge that cannot be canaried fails loud, not silent

- **Behavior:** After a successful auto-merge, if syncing the local clone to
  the merged base fails (divergence, git/network error), the run must: post a
  warning comment on the merged PR naming the merge and the sync failure;
  record the event in the run summary as its own loud line; halt the run as a
  harness-level failure. No revert is attempted against an unsynced local
  clone.
- **Source traceability:** PRD "Review and merge gate" (red → revert, halt,
  notify); WI-6 spec FR-005/FR-006; WI-6 T4 follow-up #2 (first half),
  surfaced at WI-6 verification.
- **Slice coverage:** Slice 2.
- **Success criteria:** A sync failure after merge produces the PR comment, the
  distinct summary line, a halted queue, and no revert command — each asserted
  at the loop seam with a throwing sync dependency.
- **Evidence label:** Harness-source unit tests at the public seam.
- **Boundary and errors:** Best-effort comment (a comment failure is appended
  to the failure record, never swallowed); the halt happens regardless. The
  merge itself is not rolled back locally (it exists on the remote base).
- **Non-claims:** No automatic recovery or retry of the sync; no canary result
  is claimed for the uncanaried merge; a human decides what happens to it.

### FR-003: Canary teardown failures never decide or erase the verdict

- **Behavior:** A failure while tearing down the canary environment (sandbox
  close, branch cleanup) is recorded and attached to the run's outcome; it
  must not change an already-decided canary verdict in either direction, and
  must not propagate as an unhandled error.
- **Source traceability:** WI-6 T4 follow-up #2 (second half); PRD
  "Verification" posture (failures recorded loudly, never silent).
- **Slice coverage:** Slice 2.
- **Success criteria:** A teardown failure on a green canary yields the merged
  outcome plus a recorded note (not a revert); on a red canary it yields the
  revert path with the teardown failure named. Asserted at the loop seam.
- **Evidence label:** Harness-source unit tests at the public seam.
- **Boundary and errors:** Teardown failure never blocks the revert/halt on a
  red canary.
- **Non-claims:** Teardown is not retried; leftover throwaway branches from a
  failed teardown are tolerated and cleaned by the next run's stale-branch
  pass.

### FR-004: Wired guard behaviors are pinned by tests

- **Behavior:** Three existing, wired behaviors gain failing-first assertions:
  (1) a fix diff containing a configured secret value never reaches the
  pre-merge review call (the confidentiality guard orders before the call, the
  merge is skipped, the PR stays open); (2) the throwaway review branch is
  deleted when the review run throws; (3) the non-checked-out sync path
  refuses a divergent base non-zero.
- **Source traceability:** PRD "Testing Decisions" (dedup/gate behaviors
  tested; only external behavior tested); WI-6 T6 follow-up #1, T6 follow-up
  #5, T4b advisory.
- **Slice coverage:** Slice 3.
- **Success criteria:** Each behavior has a test that fails against a tree
  where the wiring is removed (mutation-checked or justified RED note), and
  passes on the candidate.
- **Evidence label:** Harness-source unit tests; (3) real-git fixture.
- **Boundary and errors:** Test-only slice — no production behavior change.
- **Non-claims:** Does not add new guard rules, only pins existing wiring.

### FR-005: Refactor-while-green, seam-frozen

- **Behavior:** The recorded quality extractions and renames land with zero
  behavior change: the loop's merge-chain stages are extracted to named
  helpers; the duplicated test constants, upstream-advance test preamble,
  inline option-shape repeats, match-predicate duplicates, and valueless-flag
  pairs are consolidated; the PR-listing page-limit constant is renamed to
  cover both listings; one doc-comment wording is clarified.
- **Source traceability:** WI-6 review judgement calls; WI-6 checkpoint
  follow-ups (T4 #3/#4, T5 #1, T6 #2/#3, T2 #1/#2, T1 #1).
- **Slice coverage:** Slice 4.
- **Success criteria:** Full suite passes with the same test count and no
  assertion edits; typecheck clean; the boundary test (Sandcastle import
  isolation) unchanged; no public seam signature changes.
- **Evidence label:** Harness-source suite + typecheck, fresh at the
  candidate.
- **Boundary and errors:** Any test edit required by the refactor stops the
  slice and is treated as a behavior-change signal, routed back through
  review.
- **Non-claims:** No new abstraction beyond the named consolidations; the
  review-input `diff` field and the positional issue-close seam shape are
  deliberately frozen.

## Non-functional constraints

- Hard constraints 1–6 (CLAUDE.md) unchanged and untested-against here except
  as they already bind: no auto-merge on this repo; every emitted string
  continues through the confidentiality seam (FR-002's new comment and summary
  line included).
- No lint surface exists; none is added.
- Workflow.md command list stays authoritative; no command changes are
  expected (slice 4 renames an internal constant only).

## Clarifications

None — the one design fork (sync-failure shape) is decided in the carve-out
and encoded in FR-002.

## Traceability matrix

| FR | Slice | Carve-out section | WI-6 recorded source |
|---|---|---|---|
| FR-001 | 1 | 1 | review (c)1; T4 #5; T7 |
| FR-002 | 2 | 2 | T4 #2a; verification surface |
| FR-003 | 2 | 2 | T4 #2b |
| FR-004 | 3 | 3 | T6 #1, T6 #5; T4b advisory |
| FR-005 | 4 | 4 | T4 #3/#4; T5 #1; T6 #2/#3; T2 #1/#2; T1 #1 |

## Approval

Pending owner approval. On approval, status → Approved and
`writing-plans` → `ponytail` follow per the lifecycle.
