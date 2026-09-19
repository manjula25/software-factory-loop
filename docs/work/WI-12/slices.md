# WI-12 — Slices

Four items, one small work item. Item 1 is the only behavior change;
item 2 is string-level; items 3–4 are test-only. All land on
`src/loop.ts` + `src/loop.test.ts` in one worktree.

## Slice 1 — Uncanaried early-teardown recording (prd item 1)

**Behavior change.** RED: an opted-in run whose verification close throws
and whose main-sync fails (uncanaried merge) currently drops the early
teardown reason; expected observation: the uncanaried outcome carries it
and the queue line/report render it through the existing surfaces. GREEN:
conditional spread of `prOutcome.teardownFailure` on the uncanaried
return, mirroring FR-001's reverted lift. Size: small. Risk: low.

## Slice 2 — Present-handle @-rendering unification (prd item 2)

**String-level.** RED: reverted failure line pins `notify: @<handle>`;
today it renders bare. GREEN: present arm renders `notify: ${"@" + handle}`;
sanctioned pin update to test (f2)'s contrast arm in the same commit
(supersedes WI-11 FR-003's bare pin, recorded in the notes). Size: small.
Risk: low.

## Slice 3 — Reverted-path lift seam test (prd item 3)

**Test-only.** New test: verification close throws + canary red →
reverted outcome carries the early reason at outcome level (and the
canary reason in `reverted.teardownFailure`), FAILED suffix renders it.
No production change. Depends on: slice 1's pattern (lands after it for
a separable diff). Size: small. Risk: none.

## Slice 4 — Both-early-teardowns fail-path test (prd item 4)

**Test-only.** New test: preflight close throws + verification close
throws + verification rejected → the FAILED suffix carries the preflight
reason (precedence: preflight wins, it happened first). No production
change. Size: small. Risk: none.

## Sequencing

Slice 1 → 2 → 3 → 4, one commit each, one worktree; slices 3–4 may land
in either order after 1. Standing rules apply: CLAUDE.md module-row
honesty check in the same PR if a row's wording becomes inaccurate
(expected: no change — WI-11's row already says "fail() outcomes" and
"merged/reverted"; slice 1 extends recording to the uncanaried outcome,
which the row's WI-7 clause covers generically — verify, don't assume).
