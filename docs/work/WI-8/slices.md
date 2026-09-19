# WI-8 slices

Dependency-ordered; each slice is one implement checkpoint with its own
RED/GREEN evidence, reviews, and commit. All three change behavior at the
`src/loop.ts` public seam (vitest, `LoopDeps` throwing-dep knobs, mirroring the
WI-7 FR-002/FR-003 test idiom).

## Slice 1 — preflight & verification sandbox teardown parity

FR-003 posture at `src/loop.ts:640-643` (preflight `pre.close()` + `preBranch`
deletion) and `src/loop.ts:736-738` (verification `sandbox.close()`): teardown
throws are caught and recorded beside the outcome; a green verification + open
PR survives a close() throw (the PR'd outcome is returned, failure named); a
recorded baseline problem survives a teardown throw (the abort reason is not
replaced). RED: observe both current failure modes (green outcome erased;
baseline abort reason overwritten) before the fix, per the WI-7 T3 precedent.

Files: `src/loop.ts`, `src/loop.test.ts`.

Depends on: nothing.

## Slice 2 — override path surfaces teardown failures

The `--issue` single-issue terminal output shows `LoopOutcome.teardownFailure`
when present, through the existing guarded emit path (`assertNoSecrets`); no
queue summary exists on this path, so the outcome print is the only surface.
Shape (stderr line vs summary-string growth) finalized in spec review.

Files: `src/loop.ts` (the single-issue CLI print), its tests.

Depends on: slice 1 (the field it surfaces is produced there — on the merged
outcome; whether preflight/verification teardowns also ride the outcome print
is a spec decision).

## Slice 3 — uncanaried merge @-notification

The uncanaried PR comment and the `⚠️ UNCANARIED MERGE` summary detail carry
`@<notifyHandle>` when the profile configures one, and the not-configured
posture matches the reverted path ("notify handle not configured" posture).
Guarded by `assertNoSecrets` like every emitted string; the comment stays
best-effort (a comment throw still lands in `commentNote` and still halts).

Files: `src/loop.ts` (uncanaried comment body + `uncanariedDetail`), its tests.

Depends on: nothing (touches the WI-7 FR-002 surface; independent of slices
1–2).
