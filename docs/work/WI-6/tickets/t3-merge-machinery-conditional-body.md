# T3 — Merge machinery behind the flag + mode-conditional PR body

## What to build

A merge seam (squash-merge the fix PR onto the base branch) wired into the loop only
when `autoMerge: true`: after verification green, merge. Any merge failure — conflict,
base moved, API error — falls back safely: no auto-merge, PR stays open, run continues,
failure recorded loudly in the run summary. The generated PR body becomes
mode-conditional: opted-in repos get the machine-gate-chain wording; everything else
keeps today's "a human reviews and merges this" wording unchanged.

## Blocked by

T1 (the flag/profile field gates everything).

## Requirement coverage

FR-003, FR-004 wiring portion (specification.md); slice 3.

## Acceptance criteria

- [ ] With `autoMerge: true` + verification green: squash merge invoked for the PR (`unit`, stubbed merge seam)
- [ ] With the flag off: merge seam never invoked; behavior identical to today (`unit`)
- [ ] Stubbed merge failure (conflict and error variants): no merge, PR open, next queue item runs, summary names the failure (`unit`)
- [ ] PR body on opted-in repo contains gate-chain wording and not the human-review sentence; flag off → body unchanged (`unit`)

## Evidence boundary

This ticket delivers merge gated on **verification green only**, with the pre-merge
review pass as an explicit extension point between verification and merge — FR-004's
full blocking order (verification → review pass → merge) is completed by T6, which
fills that gate. One merge failure does not abort the run (proven here); canary,
revert, and everything after merge are T4. Merger-agent conflict resolution is
explicitly descoped (FR-004 non-claims; named follow-up).

## Status

Ready for planning
