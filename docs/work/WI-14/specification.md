# Testable Specification — WI-14 Escalation on Failed Fix Attempts

## Status

Approved — owner, 2026-09-20.

## Source artifacts

- `docs/work/WI-14/prd.md` — grilling record, owner decisions D1–D8 (2026-09-20).
- `docs/work/WI-14/slices.md` — three slices (comment, label lifecycle, validation + docs).
- `harness-prd-v2.md` out-of-scope line 105 amendment (2026-09-20) — brings the
  item into scope.
- Existing notify vocabulary: WI-6 D6 (handle absent), WI-11/12 (absent vs
  @-rendered arm), WI-11 recording philosophy (failure recorded verbatim,
  verdict untouched).

## Functional requirements

### FR-001: Escalation trigger — unfixed with no visible artifact

- **Behavior:** The escalation fires for exactly the outcome family where a run
  ends an issue unfixed and leaves no visible artifact of its own on GitHub:
  reproduction-test failure, verification failure, and preflight/sandbox
  failure. Outcomes that leave an open PR (review-uncertain, merge-failure
  posture, canary-red) never trigger the escalation. The trigger applies
  identically in the queue surface and the single-issue surface.
- **Source traceability:** prd.md D3, D8.
- **Slice coverage:** Slice 1 (trigger-set membership, surface parity), Slice 2
  (same trigger drives the label).
- **Success criteria:** For each trigger-family outcome, the escalation is
  emitted exactly once for that issue in that run; for each PR-left outcome,
  no escalation is emitted. Both surfaces behave identically for the same
  outcome.
- **Evidence label:** Focused vitest at the public seam of the loop module
  (queue and single-issue entry points), per the repo's testing convention.
- **Boundary and errors:** The escalation never alters the outcome it reports;
  an issue failed by infrastructure (preflight/sandbox) escalates exactly like
  a fix failure. Skipped-as-duplicate, blocked-by-dependency, and cut-by-cap
  issues never escalate.
- **Non-claims:** No cross-run suppression — two failing runs produce two
  escalations (prd.md non-claims). No attempt-counting across runs.

### FR-002: Escalation comment — channel, content, handle

- **Behavior:** The escalation is a comment on the failed GitHub issue whose
  body carries: the `@<notifyHandle>` mention when a handle is configured, the
  outcome class, the verbatim failure-reason string already reported by the run
  summary, and a pointer to where the full log lives. When no handle is
  configured, the comment still posts with no `@` and the run summary states
  the handle is not configured. The comment body contains no log excerpts.
- **Source traceability:** prd.md D2, D4; WI-6 D6 and WI-11/12 vocabulary.
- **Slice coverage:** Slice 1.
- **Success criteria:** Comment body matches the agreed shape
  (handle-arm + outcome class + verbatim reason + log pointer) for the
  handle-present and handle-absent cases; the failure-reason string in the
  body is byte-identical to the summary's FAILED-line reason.
- **Evidence label:** Focused vitest at the public seam, asserting on the
  emitted comment body.
- **Boundary and errors:** The comment body passes the secrets guard at the
  emission seam like every emitted string; non-GitHub issue sources have no
  issue to comment on and degrade to the run-summary line only.
- **Non-claims:** No diagnosis, no log excerpt, no suggested fix in the
  comment. No new notification channel (Slack/email/etc.) is introduced.

### FR-003: Inline timing and posting-failure recording

- **Behavior:** The comment is posted inline at the moment the failing lane
  fails, not batched at run end. If posting the comment fails, the posting
  failure is recorded verbatim in the run summary naming the issue, the run's
  verdict for that issue is unchanged, and no silent retry occurs.
- **Source traceability:** prd.md D5; WI-11 recording philosophy.
- **Slice coverage:** Slice 1.
- **Success criteria:** A posting failure produces the summary line and leaves
  the outcome record identical to a run where posting succeeded; no second
  posting attempt occurs within the run.
- **Evidence label:** Focused vitest (posting-failure knob at the seam).
- **Boundary and errors:** Posting failure never upgrades, downgrades, or
  retries the outcome; concurrent lanes each own their posting independently.
- **Non-claims:** No retry policy of any kind is specified — a missed
  escalation is visible as a recorded failure, not repaired automatically.

### FR-004: `harness-failed` label — add on failure

- **Behavior:** The same trigger that posts the escalation comment also adds a
  `harness-failed` label to the failed GitHub issue. If the label operation
  fails, the failure is recorded as a run-summary line only — nothing extra is
  posted to the issue — and the outcome stands.
- **Source traceability:** prd.md D6 (owner's explicit choice over the
  recommended comment-only), D7 (name, recording posture).
- **Slice coverage:** Slice 2.
- **Success criteria:** Label added exactly when FR-001's trigger fires;
  label-operation failure yields the summary line and an otherwise identical
  outcome record.
- **Evidence label:** Focused vitest at the public seam.
- **Boundary and errors:** Label add is best-effort with loud recording, same
  posture as FR-003; non-GitHub sources never label.
- **Non-claims:** The label does not encode failure class or attempt count.

### FR-005: `harness-failed` label — remove on later success

- **Behavior:** When a later run succeeds on an issue that wears the
  `harness-failed` label (fix verified and PR delivered, or the issue closed as
  fixed), the harness removes the label, so the label always means "currently
  failing." A failed removal is recorded as a summary line only; the success
  verdict stands.
- **Source traceability:** prd.md D7 (remove-on-success, chosen over
  never-remove).
- **Slice coverage:** Slice 2.
- **Success criteria:** A success on a labeled issue removes the label; an
  issue that only ever had PR-visible outcomes never wears the label; a failed
  removal changes nothing but the summary.
- **Evidence label:** Focused vitest at the public seam.
- **Boundary and errors:** Removal rides existing success paths; a label
  removed by a human out-of-band is not an error (removal is idempotent —
  a missing label is success).
- **Non-claims:** The label is the harness's only cross-run tracker state; no
  other memory of past failures is kept or implied.

### FR-006: Docs honesty in the same delivery

- **Behavior:** The CLAUDE.md module table and `docs/agents/workflow.md` gain
  the escalation surface in the same PR as the code that implements it.
- **Source traceability:** CLAUDE.md standing rule ("Keep this section
  honest…"); prd.md process note.
- **Slice coverage:** Slice 3.
- **Success criteria:** The merged PR contains both the behavior and the
  matching doc rows.
- **Evidence label:** Review of the delivered diff.
- **Boundary and errors:** N/A (documentation).
- **Non-claims:** N/A.

## Non-functional constraints

- Every emitted string (comment body, summary lines) passes the secrets guard
  at the emission seam — no new unscreened surface (hard-constraint-3 posture).
- No lint step exists in this repo; none is added.
- The harness's own repository keeps human merge; WI-14 changes nothing about
  merge policy (hard constraint 1).
- No new persistent state inside the harness; the only cross-run state is the
  GitHub label itself (prd.md D7 note).

## Clarifications

None — all eight decisions were resolved in grilling; no
`[NEEDS CLARIFICATION]` markers remain.

## Traceability matrix

| FR | prd.md decision | Slice |
|---|---|---|
| FR-001 | D3, D8 | 1, 2 |
| FR-002 | D2, D4 | 1 |
| FR-003 | D5 | 1 |
| FR-004 | D6, D7 | 2 |
| FR-005 | D7 | 2 |
| FR-006 | process | 3 |

## Approval

Approved by the owner, 2026-09-20, in-session (this line is the record).
