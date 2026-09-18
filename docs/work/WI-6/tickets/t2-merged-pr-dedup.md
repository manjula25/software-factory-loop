# T2 — Merged-PR dedup

## What to build

Acquisition/dedup treats a merged fix PR (token-matched to the issue id) as "issue done",
exactly as an open PR means "in flight" today. The stale-branch rule is re-checked
against merged state: a branch whose PR merged must never be deleted-and-retried; a
branch whose PR closed unmerged keeps today's retry semantics.

## Blocked by

None — can start immediately (independent of T1).

## Requirement coverage

FR-002 (specification.md); slice 2.

## Acceptance criteria

- [ ] Issue state (a) open PR exists → skipped as in-flight, unchanged (`unit`)
- [ ] Issue state (b) merged PR exists → skipped as done, not admitted (`unit`)
- [ ] Issue state (c) stale `fix/<id>` branch + merged PR → no branch deletion, no retry (`unit`)
- [ ] Issue state (d) stale branch + closed-unmerged PR → deleted and retried, unchanged (`unit`)

## Evidence boundary

Token matching reuses the existing issue-id match — no new matching semantics proven or
added. Source-agnostic by construction (fix PRs are always GitHub PRs); no live-GitHub
assertion beyond existing stubbed acquisition seams. Does not interact with auto-merge
mechanics (T3+).

## Status

Ready for planning
