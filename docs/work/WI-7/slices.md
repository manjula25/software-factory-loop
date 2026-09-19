# WI-7 slices

Dependency-ordered; each slice is one implement checkpoint with its own
RED/GREEN evidence, reviews, and commit. Slices 1–3 change or pin behavior at
the public seam; slice 4 is refactor-only and lands last so it never sits under
a moving target.

## Slice 1 — acquisition-time freshness (FR maps to spec FR-001..FR-003 of this WI)

`git fetch --prune origin` once per queue acquisition, before `splitQueue`
consults `mainRevertsPr` / remote fix branches. Fetch failure = harness-level
abort, loud, before any sandbox or model spend. Covers both recorded edges:
stale `origin/main` misjudging the revert guard, and stale remote `fix/*`
refs (human merges included). Override path (`--issue N`) fetches too —
`runOverrideIssue` runs the same dedup.

Files: `src/queue.ts` (or the acquisition seam the spec names), its tests.
Tests at the public seam: stale-ref fixture repo (mkdtemp real-git, as
`syncMainToOrigin` tests do) proves a reverted issue is NOT skipped on a
behind clone once the fetch runs; fetch failure aborts harness-level.

Depends on: nothing.

## Slice 2 — syncMain failure surface

After a successful auto-merge, a thrown `syncMain` must not fail open.
Behavior (shape finalized in spec review): catch the throw, post the ⚠️
warning comment on the merged PR (merge present but uncanaried; main sync
failed: <reason>), return a harness-level failure that halts the queue, and
record the event in the run summary with its own loud line. NO blind revert
against an unsynced local main. Also: the canary sandbox's `close()` /
`deleteBranch` throw in the finally joins the same handling (recorded WI-6
T4 follow-up #2, second half).

Files: `src/loop.ts` (the auto-merge chain tail), its tests.

Depends on: nothing (touches the same tail as slice 4; lands before it).

## Slice 3 — negative-path test gaps

Three wired-but-unasserted behaviors, pure test additions at the seam:

1. a fix diff containing a configured secret value never reaches `runReview`
   (guard ordering — assert the call is not made and the merge is skipped);
2. the `loop/review` branch is deleted when the review run throws;
3. `syncMainToOrigin`'s fetch-ref path (non-main current branch) throws on a
   divergent main (the optional T4b advisory).

Files: `src/loop.test.ts` (1, 2), the real-git sync tests (3).

Depends on: nothing; lands after slice 2 so test 1's skip-path assertion sees
the final failure-surface shape.

## Slice 4 — refactor-while-green batch

Pure refactor, no behavior or public-seam-signature change: extract
`runPreMergeReview()` / `runCanary()`; `advanceUpstream()` test helper;
`BoundedRunOptions` type; `covers` predicate; `valuelessFlag` helper;
`OPEN_PR_PAGE_LIMIT` → `PR_PAGE_LIMIT`; dedup `CANARY_RED_*` constants;
`autoMerge` doc-comment wording. Suite must stay byte-green (same test count,
no assertion edits) — any test edit is a signal the refactor changed behavior
and stops the slice.

Files: `src/loop.ts`, `src/queue.ts`, `src/onboard-profile.ts`, test files
(helper extraction only).

Depends on: slices 1–3 (moves the code they pin).
