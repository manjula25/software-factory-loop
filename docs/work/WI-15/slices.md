# WI-15 — Slices

**One slice.** Record: `docs/work/WI-15/prd.md` (decisions 1–9), which decided the light chain
with `to-tickets` skipped (decision 8) — there is no dependency graph to sequence, so there are
no tickets and no slice ordering to resolve.

## Slice 1 — The removal decides from the issue's label state (decisions 2, 3, 6, 7)

**Behavior change.** At a verified-PR-delivered outcome, the harness asks GitHub what labels the
issue actually carries and removes `harness-failed` **only when it is really there**. The
error-text classifier goes away entirely. A label that is not applied is a success and stays
silent (FR-005's existing boundary, now implemented by not calling rather than by forgiving an
error), including the repo-label-deleted case that the classifier used to forgive. When the read
itself fails, the failure is recorded verbatim with a reason that names the read, the removal is
skipped, and the success verdict is untouched — recorded into the existing field, rendered on
the existing lines, so no new summary vocabulary and no new outcome field appear.

Alongside the behavior: one shared constant for the label name (decision 6), since the check,
the create and the edit must not be able to drift apart.

RED: label applied → removal attempted once; label not applied → no removal attempted, nothing
recorded, verdict unchanged; read fails → removal not attempted and the read reason recorded on
the existing line; non-GitHub source (no issue url) → neither read nor removal attempted.

Size: small. Risk: low — one function's decision, on a success path that already tolerates a
failed label write.

## Slice 1b — Docs honesty (record decision 9, and the lesson)

**Docs.** The `CLAUDE.md` module-table row for `src/loop.ts` gains the read-before-remove
behavior in the same PR as the code (the table's own standing rule), and the grilling lesson
lands as one line under `## Lessons`. No `docs/agents/workflow.md` change: no command changes.

Size: small. Risk: none (review-verified).

## Sequencing

Slice 1 → 1b; both ride one PR. Standing rules apply: no lint step exists; every emitted string
passes the secrets guard at its existing emission seam; the harness repo itself keeps human
merge (hard constraint 1).