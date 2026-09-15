# T2 — Dedup and stale-branch cleanup

## What to build

Given the normalized queue, mark an issue *skipped-duplicate* when an open PR's head branch
is `fix/<id>` or its body references the issue by exact id token — never a substring match.
A `fix/<id>` branch existing without an open PR is a stale remnant: delete it and keep the
issue eligible for retry. A branch/PR listing failure aborts the run before any spend.
Skipped issues cost no sandbox, no agent run, no API spend.

## Blocked by

T1 — operates on the normalized queue.

## Requirement coverage

Slice 2; FR-002; grilling decisions 4 (existence-based identity), 11 (open-PR-primary
signal, stale-branch deletion).

## Acceptance criteria

- [ ] Vitest case with stubbed branch/PR listings: one queued issue with an open PR is
      skipped; one with only a stale branch proceeds to normal processing with the stale
      branch deleted first; skipped issues never reach sandbox creation (asserted on the
      injected-deps recorder).
- [ ] A `gh-1` reference does not match issue `gh-11` — exact-token identity asserted.
- [ ] Listing failure aborts with a named error before any sandbox or agent call.
- [ ] Existing suite stays green (`npm test`, `npm run typecheck`).

## Evidence boundary

Proves dedup identity and stale-branch behavior under stubs, including the false-positive
guard. Does not detect two different issues reporting the same underlying bug (content
matching is out of scope by decision), and does not cover the merged-PR-with-open-issue
re-attempt path live (its expected failure surfaces through the normal WI-1 gate).

## Status

Ready for planning
