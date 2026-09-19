# 5 — Refactor-while-green, seam-frozen

## What to build

The recorded quality consolidations land with zero behavior change: extract
the pre-merge review and canary stages of the merge chain into named helpers;
extract the repeated upstream-advance test preamble into a helper; name the
repeated bounded-run options shape; extract the duplicated merged-PR match
predicate and the valueless-flag argv check (both at their n=3 thresholds);
rename the PR-listing page-limit constant to cover both listings; dedupe the
byte-identical canary-red test fixtures; clarify the auto-merge opt-in
doc-comment wording.

## Blocked by

Tickets 1, 2, 3, 4 — moves the code they pin; lands last.

## Requirement coverage

FR-005 (specification.md); slice 4; carve-out §4.

## Acceptance criteria

- [ ] Full suite passes with the SAME test count and ZERO assertion edits —
      any test edit required by the refactor stops the slice and routes back
      through review.
- [ ] Typecheck clean; the Sandcastle-import boundary test file byte-unchanged.
- [ ] No public seam signature changes (review-input `diff` field and the
      positional issue-close shape deliberately frozen).
- [ ] No new abstraction beyond the named consolidations.

## Evidence boundary

Quality-only: proves non-behavior-change by the byte-green criterion, not by
new behavioral evidence. Does not hunt bugs (that is code-review's job).

## Status

Ready for planning
