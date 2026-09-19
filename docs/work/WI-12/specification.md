# Testable Specification — WI-12 (adjacent-findings batch)

## Status

Draft

## Source artifacts

- `docs/work/WI-12/prd.md` — approved carve-out (items 1–4, non-goals)
- `docs/work/WI-12/slices.md` — slices 1–4
- Originating findings: `docs/work/WI-11/review.md` (A1–A3 + adjacent
  notes), `docs/work/WI-11/implementation-notes.md`
- Approved decisions (owner, this session): **(d1)** present-handle
  rendering unifies on `notify: @<handle>` — the @ is added to the
  reverted failure line (one surface changes; both siblings already
  render it); **(d2)** the uncanaried fix attaches the field and lets the
  existing WI-8/WI-11 rendering surfaces consume it — no new surface.

## Functional requirements

### FR-001: Uncanaried outcome records the early teardown reason

- **Behavior:** When an opted-in run ends in an uncanaried merge
  (post-merge main sync failed; no canary ran) and an early sandbox
  (baseline preflight or fresh verification) teardown failed, the
  uncanaried outcome carries that reason as its `teardownFailure`, and
  the existing surfaces render it: the queue FAILED line's
  `(teardown: …)` suffix and the single-issue report's
  `sandbox teardown failed:` stderr line. The uncanaried failure string,
  failure kind, halt behavior, and exit codes are unchanged. Runs with
  clean early teardowns render exactly as today.
- **Source traceability:** prd item 1 (WI-11 adjacent finding);
  decision d2.
- **Slice coverage:** Slice 1.
- **Success criteria:** A public-seam test constructs an uncanaried run
  (sync failure) with a throwing verification close; the observed
  outcome carries the close message in `teardownFailure`, the FAILED
  line ends with the suffix, and the report stderr line names it. A
  clean-teardown uncanaried run renders byte-identical to today
  (existing pins green unmodified).
- **Evidence label:** focused vitest (harness source), plus full suite.
- **Boundary and errors:** Recording is bookkeeping; the merge stands,
  the comment still posts, the queue still halts on the uncanaried
  failure kind. No verdict, ordering, or exit-code change.
- **Non-claims:** No pipeline/Docker run (harness-source surface only).

### FR-002: Present-handle rendering unified with @

- **Behavior:** With a notify handle configured on a canary-reverted run,
  the ⚠️ REVERTED failure line renders `notify: @<handle>` — identical in
  shape to the uncanaried detail and the queue REVERTED line. Absent-
  handle rendering (`notify handle not configured`, from WI-11 FR-003)
  is unchanged on all surfaces.
- **Source traceability:** prd item 2 (WI-11 adjacent finding);
  decision d1.
- **Slice coverage:** Slice 2.
- **Success criteria:** A public-seam test pins `notify: @<handle>` on
  the reverted failure line; the two sibling surfaces' existing pins
  remain green unmodified. The supersession of WI-11 FR-003's bare
  contrast pin is a sanctioned update in the same commit, recorded in
  the implementation notes.
- **Evidence label:** focused vitest, plus full suite.
- **Boundary and errors:** String-level only. The @-ping comment body,
  halt, and exit codes untouched.
- **Non-claims:** No behavioral change on the reverted path.

### FR-003: Reverted-path early-teardown lift pinned at the seam

- **Behavior:** No production change. A test pins what WI-11 FR-001
  built: on a run with a throwing verification close AND a red canary,
  the reverted outcome carries the early reason at outcome level
  (`teardownFailure`), the canary reason stays in
  `reverted.teardownFailure`, and the queue FAILED line's teardown
  suffix names the early reason.
- **Source traceability:** prd item 3 (WI-11 review A2/A3).
- **Slice coverage:** Slice 3.
- **Success criteria:** The new test passes against current main without
  any production change (characterization pin; if it fails, that is a
  defect report, not a pin to weaken).
- **Evidence label:** focused vitest, plus full suite.
- **Boundary and errors:** None — test-only.
- **Non-claims:** Does not add the optional canary-only report-line pin
  (WI-11 review A1's optional follow-up — deliberately out of scope).

### FR-004: Both-early-teardowns precedence pinned at the seam

- **Behavior:** No production change. A test pins what WI-11 FR-002's
  recorded deviation guarantees: on a verification-rejected run where
  BOTH the preflight close and the verification close throw distinct
  messages, the outcome's `teardownFailure` carries the preflight
  reason (preflight wins — it happened first), and the FAILED suffix
  names it.
- **Source traceability:** prd item 4 (WI-11 adjacent finding).
- **Slice coverage:** Slice 4.
- **Success criteria:** The new test passes against current main without
  any production change (characterization pin; same defect-report rule
  as FR-003).
- **Evidence label:** focused vitest, plus full suite.
- **Boundary and errors:** None — test-only.
- **Non-claims:** No coverage of the merged-path both-early+canary
  triple-failure case (no such combination is reachable in one run
  without a merged outcome that FR-001/WI-11 test (p) already spans).

## Non-functional constraints

- No new module, dependency, or rendering surface; no lint (none exists).
  All tests at the public seam; never a source-text assertion.
- Hard constraints 1–6 untouched; this batch only extends WI-11's
  loud-recording posture to the last path that dropped it.
- Sanctioned pin updates (this commit only): WI-11 test (f2)'s
  present-handle contrast pin (bare → @), per FR-002. Any other breaking
  pin is a defect.

## Clarifications

None — decisions d1/d2 approved by the owner this session.

## Traceability matrix

| FR | prd item | Slice | Originating finding |
|---|---|---|---|
| FR-001 | 1 | 1 | WI-11 implementation-notes (uncanaried drop) |
| FR-002 | 2 | 2 | WI-11 review adjacent (@-rendering asymmetry) |
| FR-003 | 3 | 3 | WI-11 review A2/A3 (reverted-path lift untested) |
| FR-004 | 4 | 4 | WI-11 implementation-notes (both-early-teardowns untested) |

## Approval

Pending owner approval. On approval: `/writing-plans` (skipping
`/to-tickets` — four small slices, one implementable plan, per the
WI-9/WI-10/WI-11 precedent).
