# WI-12 — Adjacent-findings batch (PRD carve-out)

Carved from the adjacent findings recorded (with owner visibility) in
`docs/work/WI-11/review.md` and `docs/work/WI-11/implementation-notes.md`.
Same anchor as WI-11: hard constraint 2's posture — failures recorded
loudly, never dropped — plus record/consistency precision. No new product
behavior beyond closing the recorded gaps; the PRD wins on any
disagreement.

## Scope

### A. Behavior gap (harness `src/`, RED/GREEN at the public seam)

1. **Uncanaried early-teardown drop (WI-11 adjacent):** the
   uncanaried-merge return (`src/loop.ts:959-966`) does not carry
   `prOutcome.teardownFailure` — an early (preflight/verification)
   teardown failure is silently dropped on exactly the path that most
   needs loud bookkeeping (a merge with no canary, awaiting a human).
   Attach the early reason to the outcome, mirroring WI-11 FR-001's
   reverted-path lift.

### B. Rendering consistency (string-level, pinned updates in the same commit)

2. **Present-handle @-rendering pass (WI-11 adjacent):** the reverted
   failure line renders the handle bare (`notify: manjula25`) while its
   two siblings (uncanaried detail, queue REVERTED line) render
   `notify: @manjula25`. Unify. Note: the bare form was live-observed in
   WI-10 and deliberately pinned by WI-11 FR-003 — unifying now is a
   sanctioned supersession, recorded as such.

### C. Seam-coverage tests (test-only, no behavior change)

3. **Reverted-path early-teardown lift test:** the outcome-level
   `teardownFailure` on a reverted run (WI-11 FR-001's reverted arm) is
   correct by construction but unobserved at the seam — pin it.
4. **Both-early-teardowns fail-path test:** the precedence-preserving
   `earlyTeardown` spread on the fail() path (WI-11 FR-002's deviation)
   is correct by construction but unobserved — pin it (preflight reason
   wins when both close() calls throw).

## Out of scope (explicit non-goals)

- All WI-11 TASTE findings (nested ternary, assignment-of-await, "(e2)"
  naming) — taste never becomes requirements.
- Any change to verdict logic, failure kinds, halt behavior, or exit
  codes beyond item 1's additive field.
- Fixtures issue #26 (separate owner decision, not a harness item).
- Anything in the PRD's out-of-scope list (dependency-aware queue,
  scheduled runs, cloud sandboxes, …).

## Open design decisions (for the spec stage)

1. Item 2's direction: unify on `notify: @<handle>` (add the @ to the
   reverted failure line — recommendation; the @ is the ping convention
   both siblings already use) vs unify on bare (strip @ from siblings —
   larger pin churn, loses the ping visual).
2. Item 1's rendering surface: with the field attached, the uncanaried
   outcome automatically gains the queue FAILED-suffix/report stderr line
   via existing WI-8/WI-11 rendering — confirm no additional surface is
   wanted (recommendation: none; existing surfaces suffice).
