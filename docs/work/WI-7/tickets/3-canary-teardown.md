# 3 — Canary teardown failures never decide or erase the verdict

## What to build

A failure while tearing down the canary environment (sandbox close, branch
cleanup) is recorded and attached to the run's outcome. It must not change an
already-decided canary verdict in either direction — a green canary stays
merged (with a recorded note), a red canary still reverts (with the teardown
failure named) — and it must never propagate as an unhandled error.

## Blocked by

Ticket 2 — same code region (the auto-merge chain tail); lands after its
failure-surface shape so the two never conflict.

## Requirement coverage

FR-003 (specification.md); slice 2 (second half); carve-out §2.

## Acceptance criteria

- [ ] A teardown throw on a green canary yields the merged outcome plus a
      recorded note (not a revert, not a crash) (RED first: current tree
      treats it as red or propagates).
- [ ] A teardown throw on a red canary still runs the revert path, with the
      teardown failure named in the record.
- [ ] No unhandled rejection / raw stack trace on either path.
- [ ] Full suite + typecheck green.

## Evidence boundary

Proves verdict-preservation at the loop seam. Teardown is not retried;
leftover throwaway branches from a failed teardown are tolerated (the next
run's stale-branch pass cleans them) — not proven here.

## Status

Ready for planning
