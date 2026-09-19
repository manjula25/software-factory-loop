# 1 — Acquisition-time remote-state refresh

## What to build

Before any queue dedup or re-queue judgment consults git-derived remote state
(merged-PR revert detection, remote fix-branch listing, stale-branch cleanup),
the target clone's remote refs are refreshed once per acquisition via a
fetch-with-prune. Both entry paths get it: queue mode and the `--issue N`
override (both run the same dedup). A failed refresh aborts the run
harness-level — loud, named, exit non-zero — before any sandbox, model call,
or PR action.

## Blocked by

None — can start immediately.

## Requirement coverage

FR-001 (specification.md); slice 1; carve-out §1.

## Acceptance criteria

- [ ] On a clone whose `origin/main` tracking ref predates a remote revert
      (real-git throwaway repos), a reverted issue is admitted as eligible —
      not skipped-merged — after the refresh runs (RED first: stale clone
      without the refresh skips it).
- [ ] A remotely deleted `fix/*` branch is absent from the branch listing the
      acquisition sees after the refresh.
- [ ] A failed refresh produces a harness-level abort with a named reason and
      non-zero exit; no sandbox or model call happens (asserted at the seam).
- [ ] The refresh runs once per acquisition, not per issue (asserted at the
      seam).
- [ ] Full suite + typecheck green.

## Evidence boundary

Proves the freshness fix at the harness-source seam with real-git fixtures.
Does not re-prove the live GitHub path (WI-6 T7/T7b already did); does not
change what dedup decides, only the freshness of what it decides on.

## Status

Ready for planning
