# WI-8 PRD carve-out — failure-surface parity batch

Derived from `harness-prd-v2.md` (plan of record) and the WI-7 evidence trail
(`docs/work/WI-7/review.md` follow-up backlog, `implementation-notes.md` adjacent
follow-ups, `verification.md` deferred list; the preflight/verification teardown
item originates in the WI-7 T3 notes, which flagged it as "same failure class,
out of this slice's scope"). The PRD wins on any disagreement. This is a
traceability artifact, not a new product requirement: every item below is a
recorded follow-up on surfaces the PRD and hard constraints already mandate.

## Why this work item exists

WI-7 made the canary's teardown failure-safe (FR-003: recorded beside the verdict,
never deciding or erasing it) and defined the uncanaried-merge failure surface
(FR-002) — but only for the canary block. The same failure class still propagates
raw at the two earlier sandboxes, the single-issue path cannot show the new
teardown field, and the uncanaried warning reaches nobody who can act on it. This
work item brings every remaining failure surface in the loop to the same posture
the already-fixed surfaces hold. None of it changes the product's purpose, scope,
or any hard constraint.

## Scope

### 1. Preflight & verification sandbox teardown parity (correctness)

PRD anchor: "Review and merge gate" + hard constraint 2 (verification posture);
WI-7 spec FR-003 (the established posture this extends).

Two `finally` blocks still let a teardown throw propagate raw and erase the
run's actual outcome, exactly the defect FR-003 fixed for the canary:

- **Preflight** (`src/loop.ts:640-643`): `pre.close()` or the `preBranch`
  deletion throwing masks whatever the baseline check concluded — including a
  green baseline (the run dies before the fix attempt) or a recorded
  `baselineProblem` (the abort reason is replaced by a teardown stack trace).
- **Verification** (`src/loop.ts:736-738`): `sandbox.close()` throwing after a
  green verification + open PR discards the successful outcome — the fix IS
  verified and PR'd, but the run reports a raw crash instead.

Fix: FR-003 posture at both sites — teardown failures are recorded beside the
outcome and never decide or erase it. Exact surface shape (outcome field vs
summary suffix) is a spec-review decision recorded in `specification.md`.

### 2. Override path can see teardown failures (operational visibility)

PRD anchor: "Testing Decisions" (observable behavior at the seam) + the WI-7
T3 plan's own sanctioned omission ("the single-issue `--issue` override path
prints no `teardownFailure` line — possible doc tweak or sibling stderr line
in a follow-up").

`LoopOutcome.teardownFailure` exists (WI-7 FR-003) and rides the queue summary,
but the `--issue` single-issue path's terminal output never shows it. A
one-issue run has no queue summary — the line is the only terminal surface.
The field must reach the operator through the existing guarded emit path.

### 3. Uncanaried merge @-notification (revert-net completeness)

PRD anchor: hard constraint 1 — "on red: auto-revert, run halt, immediate
@-mention notification"; the uncanaried merge is the sibling case (merge
present, verification impossible) recorded in WI-7's T2 notes as "any
uncanaried @-notification needs its own FR".

The uncanaried PR comment names the merge commit and sync failure but does not
@-mention `notifyHandle` — while the reverted path does (`RevertedRecord.
notifyHandle`, `notify: @<handle>` on the summary line). An uncanaried merge
demands a human decision MORE urgently than a clean revert; today nobody is
pinged. Fix: the uncanaried comment (and its summary detail) includes the
configured notify handle when present, through the existing `assertNoSecrets`
guarded emit; absent handle keeps a "notify handle not configured" posture
matching the reverted path.

## Out of scope (explicit)

- Pipeline-integration (Docker/gh) run of the loop — the standing non-claim,
  its own future work item.
- The cleanup & docs batch (axis-4 judgment calls, `syncMainToOrigin` seam
  reuse, spec-text amendments, WI-6 cosmetics) — backlog.
- Teardown retry, or cleanup of leftover throwaway branches on failed teardown
  (tolerated by the next run's stale-branch pass, per WI-7 T3 posture).
- Any change to hard constraints, auto-merge gating, or the PRD's product
  scope.

## Success criteria

At delivery: both sandbox teardown sites hold the FR-003 posture (green stays
green, recorded failures stay recorded — unit-proven at the loop seam with
throwing teardown deps, both pre-fix failure modes observed RED); the
`--issue` path surfaces a teardown failure in its terminal output; the
uncanaried comment and summary carry the notify handle when configured (and say
so when not); full suite + typecheck fresh and green at the delivered
candidate; no public-seam signature change beyond the spec's named additions.
