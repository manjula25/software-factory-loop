# 4 — Negative-path test pins for wired guard behaviors

## What to build

Three existing, wired behaviors gain failing-first assertions (test-only
slice, no production change):

1. A fix diff containing a configured secret value never reaches the
   pre-merge review call: the guard orders before the call, the merge is
   skipped, the PR stays open.
2. The throwaway review branch is deleted when the review run throws.
3. The sync path for a non-checked-out base (fetch-ref form) refuses a
   divergent base non-zero (real-git throwaway repos).

## Blocked by

Ticket 2 — assertion 1's skip-path shape must see the final failure surface.

## Requirement coverage

FR-004 (specification.md); slice 3; carve-out §3.

## Acceptance criteria

- [ ] Assertion 1: with a secret configured in the guard env and present in
      the diff, the review-call dependency is never invoked; the outcome is
      the no-merge skip with the PR open.
- [ ] Assertion 2: review dependency throws → the `loop/review` branch
      deletion dependency still ran.
- [ ] Assertion 3: divergent base on the fetch-ref path throws (real-git
      fixture).
- [ ] Each assertion is justified RED (mutation check or documented RED note)
      — the wiring it pins is removable.
- [ ] Full suite + typecheck green.

## Evidence boundary

Pins existing wiring only; adds no new guard rules. Assertion 3 exercises
real git in a throwaway clone, not the Docker sandbox path.

## Status

Ready for planning
