# WI-15 — Testable Specification

## Status

In force. Carried through `writing-plans` and `implement` under owner direction (2026-09-23/24);
**amended 2026-09-24** — see Amendments below for what changed, by whose authority, and why.

## Source artifacts

- `docs/work/WI-15/prd.md` — grilling record; decisions 1–9 govern. Corrects the A9 description
  recorded at WI-14 (see that record's "Corrected understanding").
- `docs/work/WI-15/slices.md` — one slice.
- `harness-prd-v2.md` — untouched (no product-scope change; the product behavior this implements
  is WI-14's FR-005 boundary, "a missing label is success").

## Functional requirements

### FR-001: The label removal decides from the issue's current label set

- **Behavior:** At a verified-PR-delivered outcome for a GitHub-sourced issue, the harness reads
  the issue's labels and removes the `harness-failed` label **only when the issue currently
  carries it**. When it does not carry it, no removal is attempted, nothing is recorded, and the
  outcome is otherwise unchanged — a missing label is success, as the existing boundary already
  states.
- **Source traceability:** prd.md decisions 1, 2; WI-14 FR-005 boundary ("a label removed by a
  human out-of-band is not an error (removal is idempotent — a missing label is success)").
- **Slice coverage:** Slice 1.
- **Success criteria:** a labeled issue is unlabeled (removal attempted exactly once); an
  unlabeled issue is left alone with no removal attempted and no failure recorded; the
  delivered-success verdict is identical in both cases; a source with no GitHub issue is
  neither read nor removed.
- **Evidence label:** Focused vitest at the public seam.
- **Boundary and errors:** Applies only where an issue is addressable on GitHub (the existing
  guard); the read reflects the state at removal time, not at run start.
- **Non-claims:** Does not promise the removal itself succeeds once the label is confirmed
  present (FR-002 covers that arm). The membership test compares the label name as GitHub
  returns it; the harness creates the label itself, so the name it checks is the name it wrote.

### FR-002: No subprocess error text is interpreted in the label removal path

- **Behavior:** The removal no longer decides whether a failure is harmless by matching phrases
  in a subprocess's error output. A failure while removing a label that the harness has
  confirmed is present is a real failure: it is recorded verbatim and reported, never excused.
- **Source traceability:** prd.md decision 2 and its "Corrected understanding" section (the
  measured reachable forgiveness was correct in its only reachable case, so the defect was the
  **silence**, not the verdict).
- **Slice coverage:** Slice 1.
- **Success criteria:** with the label confirmed present, a failing removal produces the
  recorded failure reason and the existing summary/report line, and the delivered-success
  verdict is unchanged; no failure path in the label removal completes without a record.
- **Evidence label:** Focused vitest at the public seam for the recorded-failure arm; the
  absence of error-text matching is confirmed by review of the delivered diff, not by a
  behavioral test.
- **Boundary and errors:** This requirement governs the **removal** decision. The create-time
  `already exists` check on label *creation* is deliberately kept (prd.md decision 5): it is a
  narrow, single-purpose match that aborts loudly before any spend, and it is outside this
  requirement. The removal call itself may still fail for any reason; every such failure is
  recorded.
- **Non-claims:** Does not claim the removal is retried (it never is, and stays unretried).

### FR-003: A failing label read is recorded, and the removal is skipped

- **Behavior:** When reading the issue's labels fails, the harness records that failure verbatim
  — with a reason that identifies the read as the failed step — skips the removal entirely, and
  leaves the delivered-success verdict untouched. It does not proceed to remove, and it does not
  skip silently.
- **Source traceability:** prd.md decision 3.
- **Slice coverage:** Slice 1.
- **Success criteria:** a throwing read → removal not attempted; the read's failure appears in
  the run summary and in the single-issue report; the outcome's success fields are unchanged; the
  label remains on the issue and the next successful run attempts the removal again.
- **Evidence label:** Focused vitest at the public seam.
- **Boundary and errors:** The recorded reason is the subprocess failure text; it is prefixed so
  it cannot be mistaken for a failed removal.
- **Non-claims:** Skipping is not a retry mechanism — the recovery is the next run, not this one.
  A stale label between the two is accepted (prd.md decision 3).

### FR-004: One field, one line — no new vocabulary

- **Behavior:** A failed read and a failed removal record into the **same** existing outcome
  field, rendered by the **same** existing summary line and single-issue report line. The line
  wordings do not change.
- **Source traceability:** prd.md decision 4.
- **Slice coverage:** Slice 1.
- **Success criteria:** the queue summary and single-issue report for a read failure read exactly
  as they do for a removal failure, with the reason text naming the failed step; no new outcome
  field exists; no operator-facing line is added or renamed.
- **Evidence label:** Focused vitest at the public seam.
- **Boundary and errors:** The reason prefix is the only new text.
- **Non-claims:** Does not claim the two failures are distinguishable by line — they are
  distinguishable only by the reason text, deliberately.

### FR-005: One source of truth for the label name

- **Behavior:** The label name used to create the label, to add or remove it, to test membership,
  and to name the label to the operator in the harness's own output is defined once, so those uses
  cannot drift apart.
- **Source traceability:** prd.md decision 6.
- **Slice coverage:** Slice 1.
- **Success criteria:** a single definition supplies every use of the label name — the create,
  the add, the remove, the membership test, and the operator-facing message text that names the
  label to the operator — so no second literal of the name appears in code or in emitted output.
  Comments, JSDoc and test fixtures are documentation and fixture text: they may name the label,
  and are outside this criterion.
- **Evidence label:** Review of the delivered diff.
- **Boundary and errors:** N/A (structural).
- **Non-claims:** This is a structural constraint, not a behavioral one — it is review-evidenced
  and makes no claim a behavioral test could carry.

### FR-006: Docs honesty in the same delivery

- **Behavior:** The `CLAUDE.md` module-table row for the per-issue loop gains the
  read-before-remove behavior in the same PR as the code, and the grilling's lesson is recorded
  as one line under `## Lessons`.
- **Source traceability:** prd.md decisions 9 and the lesson paragraph; `CLAUDE.md`'s standing
  rule that the module table stays honest in the same PR.
- **Slice coverage:** Slice 1b.
- **Success criteria:** the merged PR contains both the behavior and the matching doc rows; no
  `docs/agents/workflow.md` command change (none exists to make).
- **Evidence label:** Review of the delivered diff.
- **Boundary and errors:** N/A (documentation).
- **Non-claims:** N/A.

## Non-functional constraints

- **Secrets posture is unchanged.** The newly recorded reason rides an existing field and an
  existing line, whose emission seam is already guarded — no new emitted surface and no new gap.
  WI-15 changes no secrets-guard posture and repairs none.
- **Evidence boundary.** The two `gh` calls themselves (the label read and the label removal)
  are subprocess wiring: not exercised by vitest, and **no live run is bought for this work
  item** (prd.md decision 7). Their correctness rests on review plus the recorded probes in
  `docs/work/WI-15/evidence/` — nine blocks in two sets (five pre-grilling commands, four T2 shape
  probes) plus a local `stdio` reproduction — and that limit is stated as a non-claim in the
  verification record.
- **No new command surface.** There is no lint step in this repository and none is added; the
  authoritative command list (`docs/agents/workflow.md`) is unchanged.
- **Local Docker only** (hard constraint 6) — not engaged: no image, script, or sandbox change.
- **Hard constraint 1 is untouched.** No merge, review, canary, or revert behavior changes;
  this work item is delivery-neutral.

## Clarifications

None. Every decision this requirement set depends on was settled in the grilling record; no
`[NEEDS CLARIFICATION]` marker remains.

## Amendments

**2026-09-24 — FR-005's success criterion (owner-authorized); FR-002's title and boundary, and
the stale status headers (the controller's own calls, on the same reasoning).**
The specification review of the delivered implementation found FR-005's criterion — "no second
literal of the label name remains in the source" — **unsatisfiable as written**: the label name
legitimately survives in comments, JSDoc and the test fixtures, and stripping those would destroy
documentation and fixture text rather than strengthen the requirement. The same review found
FR-002's title claiming more than the delivered code does, because the create-time
`already exists` check on label *creation* is deliberately kept (prd.md decision 5). The owner
directed the criterion be amended to the uses it was always meant to cover rather than left
disagreeing with the code. FR-002's title is **narrowed**, not replaced: "anywhere in the label
path" becomes "in the label removal path", which is the Behavior clause it already carried, and
its boundary now names the kept create-time exception explicitly.

**Authority, attributed exactly.** The owner was asked about **FR-005's criterion alone**, and
directed it be amended. The FR-002 title and boundary change, and the correction of the stale
status headers in this file and in `implementation-plan.md`, were the **controller's own calls**
on the same reasoning. They are not presented here as owner decisions, and the heading above
attributes them accordingly.

**No behavioral requirement changed.** Nothing the harness does is different, and the review found
no behavior defect in the label path. The three message sites the review flagged —
`src/loop.ts:2207` (the FAILED-line suffix), `:2528` and `:2564` (the single-issue report lines) —
were fixed in the same pass by interpolating the shared constant; a fourth operator-facing site,
the create-time `console.log` at `:3011`, already used it. The code therefore now does what these
criteria ask.

## Traceability matrix

| FR | prd.md basis | Slice | Evidence |
|---|---|---|---|
| FR-001 | decisions 1, 2 | 1 | focused vitest (public seam) |
| FR-002 | decision 2 + Corrected understanding | 1 | focused vitest + review of the diff |
| FR-003 | decision 3 | 1 | focused vitest (public seam) |
| FR-004 | decision 4 | 1 | focused vitest (public seam) |
| FR-005 | decision 6 | 1 | review of the delivered diff |
| FR-006 | decisions 9, lesson | 1b | review of the delivered diff |

## Approval

In force. The owner carried this specification through `writing-plans` and `implement`
(2026-09-23/24); **amended 2026-09-24** — see Amendments above for which change the owner
authorized and which were the controller's.