# 2 — Uncanaried-merge failure surface

## What to build

When syncing the local clone to the merged base fails after a successful
auto-merge (divergent local main, git/network error), the run must: post a
warning comment on the merged PR naming the merge and the sync failure;
record the event in the run summary as its own loud line; halt the queue as a
harness-level failure. No revert is attempted against an unsynced local
clone. The new comment and summary line pass the confidentiality seam like
every other emitted string.

## Blocked by

None — can start immediately.

## Requirement coverage

FR-002 (specification.md); slice 2 (first half); carve-out §2.

## Acceptance criteria

- [ ] A throwing sync dependency after a successful merge produces: the PR
      warning comment (body asserted at the seam), a distinct summary line
      (exact-pin test), a halted queue / non-zero exit.
- [ ] No revert command is issued on this path (asserted at the seam).
- [ ] A failed comment post is appended to the failure record, never
      swallowed; the halt happens regardless.
- [ ] Both the queue path and the `--issue N` override path surface the
      failure loudly (override: guarded stderr line + exit 1).
- [ ] RED evidence first; full suite + typecheck green.

## Evidence boundary

Proves the failure surface at the loop seam with a throwing sync dependency.
Does not claim any canary result for the uncanaried merge; no automatic
recovery or retry of the sync; the uncanaried merge is left for a human.

## Status

Ready for planning
