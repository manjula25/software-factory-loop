# T5 — Issue closing on merge

## What to build

Only after the canary is green, a gh-sourced issue whose fix PR auto-merged is closed
with an evidence comment naming the merged PR and the canary result. Spec-doc and
plain-list sources are a no-op. Canary-red issues are never closed — they were
reverted and stay queued.

## Blocked by

T4 (closing is strictly merge → canary green → close; never before the canary).

## Requirement coverage

FR-008 (specification.md); slice 5.

## Acceptance criteria

- [ ] Green path, gh-sourced issue → issue closed with an evidence comment naming the PR and canary result (`unit`, close seam)
- [ ] Green path, file-sourced issue (spec-doc/plain-list) → no close action, no error (`unit`)
- [ ] Red path (reverted) → no close action even for gh-sourced issues (`unit`)
- [ ] Close/comment failure → recorded loudly; no revert, no halt (fix is merged and canary-green; closing is bookkeeping) (`unit`)

## Evidence boundary

Proves the close seam wiring and ordering only. No issue-reopening logic, no
cross-links beyond the evidence comment, and no closing of PRs a human merged (human
flow unchanged, out of scope).

## Status

Ready for planning
