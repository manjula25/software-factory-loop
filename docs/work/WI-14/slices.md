# WI-14 — Slices

Three slices, one work item, all on the failure/notify seam of the per-issue
loop (record: `docs/work/WI-14/prd.md`, decisions D1–D8). Slices 1 and 2 are the
behavior carriers; slice 3 is bounded validation + docs honesty.

## Slice 1 — Escalation comment on failure (record decisions 1–5, 8)

**Behavior change.** When a run ends an issue unfixed with no visible artifact
of its own (the `fail()` family: repro-test failure, verification failure,
preflight/sandbox failure), the harness posts a comment on that GitHub issue:
`@<notifyHandle>` (absent → no `@`, summary says "notify handle not
configured" — D6 vocabulary), the outcome class, the **verbatim** failure
reason, and a pointer to the full log. No log excerpts. Fires inline at the
moment the lane fails, in **both** the queue runner and the single-issue
surface. A failed comment-post is recorded verbatim in the summary and never
touches the verdict (WI-11 recording posture). Outcomes that leave an open PR
(review-uncertain, merge-failure, canary-red) never trigger it.
RED: trigger-set membership (each `fail()` arm fires; each PR-left arm does
not), comment content and handle-absent shape, posting-failure recording,
single-issue surface parity.
Size: medium. Risk: medium (concurrent lanes share the notify seam).

## Slice 2 — Label lifecycle (record decisions 6, 7)

**Behavior change.** The same trigger adds a `harness-failed` label to the
issue; a later run that succeeds on the issue (PR delivered / issue closed)
removes it — the label means "currently failing," not "ever failed." A failed
label-add/remove is a summary line only (same recording posture, nothing posted
to the issue). Non-GitHub issue sources (WI-3b) degrade to the run-summary line
only for both comment and label.
RED: label added on failure, removed on later success, left alone when the
issue merely had a PR-visible outcome, label-op failure recording, non-GitHub
degradation.
Size: small–medium. Risk: low.

## Slice 3 — Docs honesty + live validation (record: mechanical consequences)

**Validation + docs.** CLAUDE.md module-row and `docs/agents/workflow.md`
updates ride the same PR as the code. One live run against the seeded fixtures
repo with a deliberately unfixable issue: proves the comment + label appear on
the failed issue, and — on a follow-up run that fixes it — the label is
removed. Size: small. Risk: low (observation-shaped).

## Sequencing

Slice 1 → 2 → 3; 2 rides 1's trigger, 3 validates both. Standing rules apply:
no lint step exists; every emitted string through the secrets guard; the
harness repo itself keeps human merge.
