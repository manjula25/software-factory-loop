# T4 — Post-merge canary, auto-revert, run halt, notification

## What to build

After every successful auto-merge: a fresh-sandbox full-suite run (repro + complete
suite, including all prior regression tests) against the merged base branch — the
canary. Green → proceed. Red → revert the merge commit, halt the entire queue run (no
further issues admitted), keep the reverted issue queued for a future run (merged-dedup
must not swallow it), post exactly one @-mention comment on the merged PR, emit a loud
`⚠️ REVERTED` run-summary section, exit non-zero.

## Blocked by

T3 (canary fires after merge machinery exists).

## Requirement coverage

FR-005, FR-006, FR-007 (specification.md); slice 4.

## Acceptance criteria

- [ ] Every successful merge is followed by a fresh-sandbox suite run on the merged base; result recorded in the summary (`unit`)
- [ ] Canary green → run proceeds to the next issue (`unit`)
- [ ] Canary red → revert invoked for exactly the merge commit just landed (`unit`)
- [ ] Red → no further queue item admitted; run exits non-zero (`unit`)
- [ ] Red → reverted issue remains eligible for a later run — not deduped away by T2's merged-PR rule (`unit`)
- [ ] Red → one @-mention comment on the merged PR + `⚠️ REVERTED` summary section with issue, merge commit, revert commit, canary evidence (`unit`)
- [ ] Non-reverting paths: no such comment, no such section (`unit`)
- [ ] Canary that cannot start (sandbox failure) is treated as red (`unit`)

## Evidence boundary

Revert failure is recorded loudly and the run still halts and exits non-zero — revert
is best-effort, halt is unconditional. Comment-posting failure does not un-halt. The
mention target is a configured identity. Live red/green observation is deferred to T7;
this ticket proves wiring with stubbed sandbox/canary/revert/comment seams.

## Status

Ready for planning
