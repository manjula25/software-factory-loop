# Testable Specification — WI-8 (failure-surface parity batch)

## Status

Draft

## Source artifacts

- `docs/work/WI-8/prd.md` (carve-out; PRD of record `harness-prd-v2.md` wins on
  any disagreement)
- `docs/work/WI-8/slices.md` (3 dependency-ordered slices)
- Evidence base: `docs/work/WI-7/review.md` (follow-up backlog),
  `docs/work/WI-7/implementation-notes.md` (T2/T3 adjacent follow-ups),
  `docs/work/WI-7/verification.md` (deferred list); the preflight/verification
  teardown item originates in WI-7 T3's notes ("same failure class, out of this
  slice's scope").

## Functional requirements

### FR-001: Preflight and verification teardown failures never decide or erase the outcome

- **Behavior:** A failure while tearing down the baseline-check sandbox (close,
  branch cleanup) or the fix-verification sandbox (close) is recorded beside
  the run's outcome and must not change what the run already concluded, in
  either direction, and must not propagate as an unhandled error. A green
  baseline check proceeds to the fix run with the teardown failure recorded; a
  recorded baseline problem is reported as the abort reason, not replaced by
  the teardown error; a green verification with an open PR yields the PR'd
  outcome with the teardown failure recorded. This is the posture WI-7 FR-003
  established for the canary sandbox, extended to the two earlier sandboxes.
- **Source traceability:** PRD "Review and merge gate" + hard constraint 2
  (verification posture — failures recorded loudly, never silent); WI-7 spec
  FR-003 (the established posture); WI-7 implementation-notes T3 adjacent
  follow-up ("preflight/verification sandboxes' teardown still propagates —
  same failure class, out of scope"); WI-7 verification deferred list.
- **Slice coverage:** Slice 1.
- **Success criteria:** At the loop seam with throwing teardown dependencies,
  pre-fix: a green-verification run whose verification-sandbox close throws
  reports a raw failure instead of the PR'd outcome, and a baseline abort
  whose preflight close throws reports the teardown error instead of the
  baseline reason — both failure modes observed RED before the fix. Post-fix:
  both runs return their already-decided outcome with the teardown failure
  recorded on it and named on the run summary's existing surfaces; a green
  baseline plus preflight teardown failure still reaches the fix run.
- **Evidence label:** Harness-source unit tests at the public seam.
- **Boundary and errors:** The teardown failure rides the same summary
  surfaces the merged/reverted outcomes already use; no new unguarded
  emission. The failure is recorded once per sandbox, not per retry.
- **Non-claims:** Teardown is not retried; leftover throwaway branches from a
  failed teardown are tolerated (cleaned by the next run's stale-branch
  pass); no Docker/gh run of a teardown failure is claimed.

### FR-002: A single-issue run can see a recorded teardown failure

- **Behavior:** When a run executed through the single-issue override carries
  a recorded teardown failure, the operator's terminal output for that run
  names it. The queue summary is absent on this path, so the single-issue
  output is the failure's only terminal surface.
- **Source traceability:** PRD "Testing Decisions" (observable behavior at the
  seam); WI-7 implementation-notes T3 adjacent follow-up (the plan's own
  sanctioned omission: "the single-issue `--issue` override path prints no
  `teardownFailure` line"); WI-7 verification deferred list.
- **Slice coverage:** Slice 2.
- **Success criteria:** A single-issue run with a recorded teardown failure
  prints it through the guarded emit path, asserted at the loop/CLI seam;
  runs without a teardown failure print nothing new (byte-stable existing
  output).
- **Evidence label:** Harness-source unit tests at the public seam.
- **Boundary and errors:** The line passes the confidentiality seam like every
  emitted string; its absence is not an error.
- **Non-claims:** No queue-mode output change (the queue summary already
  carries the failure); no new exit-code semantics — an exit code change is
  explicitly not part of this FR.

### FR-003: An uncanaried merge pings the configured notify handle

- **Behavior:** The warning posted on an uncanaried merge (WI-7 FR-002
  surface) includes an @-mention of the profile's configured notify handle
  when one is set, and the uncanaried summary detail records the notify
  posture explicitly — mention when configured, a named not-configured
  posture when not — matching the reverted path's existing behavior. An
  uncanaried merge demands a human decision; the notification is the
  compensating control hard constraint 1 names.
- **Source traceability:** Hard constraint 1 ("immediate @-mention
  notification" — the revert net's compensating control, extended to its
  sibling case); WI-7 implementation-notes T2 adjacent follow-up ("any
  uncanaried @-notification needs its own FR"); WI-7 verification deferred
  list.
- **Slice coverage:** Slice 3.
- **Success criteria:** With a handle configured, the uncanaried PR comment
  and the summary detail carry the @-mention (asserted at the loop seam with
  a throwing sync dependency); without one, both carry the named
  not-configured posture; the comment remains best-effort (a comment failure
  still lands in the comment record and the run still halts).
- **Evidence label:** Harness-source unit tests at the public seam.
- **Boundary and errors:** Every new or changed emitted string passes the
  confidentiality seam before emission; a missing handle is not an error.
- **Non-claims:** No new notification channels (no email/chat); no change to
  the halt, the no-blind-revert rule, or the merge itself.

## Non-functional constraints

- Hard constraints 1–6 (CLAUDE.md) unchanged. FR-003 tightens constraint 1's
  notification spirit on an existing surface; auto-merge gating is untouched;
  this repo still never auto-merges itself.
- No lint surface exists; none is added.
- `docs/agents/workflow.md` command list stays authoritative; no command
  changes are expected.
- Public-seam stability: no dependency-signature changes beyond what the spec
  names (new failure-recorded data on existing surfaces); the review-input
  `diff` field and positional issue-close seam remain frozen.

## Clarifications

None. The two design forks are decided here for approval: (a) a green
baseline plus preflight teardown failure still proceeds to the fix run
(verdict-preservation parity — the failure is recorded, never a new verdict);
(b) FR-002 adds a terminal line only, not an exit-code change.

## Traceability matrix

| FR | Slice | Carve-out section | WI-7 recorded source |
|---|---|---|---|
| FR-001 | 1 | 1 | T3 adjacent follow-up; verification deferred list |
| FR-002 | 2 | 2 | T3 adjacent follow-up (sanctioned omission) |
| FR-003 | 3 | 3 | T2 adjacent follow-up; constraint 1 |

## Approval

Pending owner approval. On approval, status → Approved and
`writing-plans` → `ponytail` follow per the lifecycle.
