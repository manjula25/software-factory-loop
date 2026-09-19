# Delivery — WI-7

## Work item

WI-7 — post-WI-6 hardening & cleanup batch. Five FRs traced to
`docs/work/WI-7/prd.md` (carve-out from WI-6 findings) via `slices.md` →
`specification.md` → tickets 1–5 → `implementation-plan.md`.

## Summary

Five tasks, one commit each, each with leaf-implementer TDD evidence, controller
fresh gates, and sequential spec-then-quality reviews (all PASS/APPROVED at fixed
packages):

- **FR-001** (`7d84b10`): acquisition-time remote refresh — required
  `QueueDeps.refreshRemoteRefs` awaited first in `splitQueue` (`git fetch --prune
  origin` in `main()`), so a revert landed on origin after the clone restores its
  issue to todo; refresh failure aborts acquisition loudly. Real-git stale-clone
  proof.
- **FR-002** (`27abf15`): uncanaried-merge failure surface — post-merge `syncMain`
  throw posts a guarded ⚠️ UNCANARIED PR comment, records the event
  (outcome `uncanaried`, `⚠️ UNCANARIED MERGE` summary line), halts the queue; never
  blind-reverts, never runs a canary on this path.
- **FR-003** (`23f0a35`): canary teardown failures recorded beside the verdict,
  never deciding or erasing it (base defect: a close()-throw silently swallowed on
  green / overwrote decided evidence on red — both now pinned).
- **FR-004** (`2bbca7d`): three negative-path pins (secret-diff blocks review,
  throw-path branch deletion, divergent-base refusal) with recorded mutation checks;
  test-only.
- **FR-005** (`3a12444`): refactor-while-green batch — 7 of 8 consolidations
  (`runPreMergeReview`/`runCanary` extraction, `advanceUpstream`, `BoundedRunOptions`,
  `covers`, `PR_PAGE_LIMIT`, `CANARY_RED_SUITE`, doc wording); `valuelessFlag`
  sanctioned-stopped (n=2, premise wrong).

Post-review: both code-review blockers resolved at `22db046` (test knob per-target
matching; CLAUDE.md module table honesty), review record at `b6c81d1`.

## Plan artifacts

`docs/work/WI-7/`: prd.md, slices.md, specification.md, tickets/1–5,
implementation-plan.md, implementation-notes.md, verification.md, review.md,
delivery.md (this file).

## Verification

`verification.md` (completion section, fresh 2026-09-19 at `f868771`, superseded only
by docs/test-only commits): typecheck exit 0; full suite 10 files / 207 tests exit 0
(baseline 195 + 12). Gates re-run fresh after the review fixes at `22db046`:
`src/loop.test.ts` 99/99, typecheck exit 0, full suite 10 files / 207 exit 0.
Unknowns: 4 closed with evidence, remainder deferred with owners.

## Evidence boundary

Harness-source surface only: vitest public-seam tests (incl. real-git throwaway
origin/clone scenarios) + tsc. No lint exists. No production behavior changed after
the reviewed candidate except none — `22db046` is test-only + doc-only.

## Non-claims

- No pipeline-integration (Docker/fixtures/gh) run of the WI-7 tree — deliberate
  plan non-claim; FR-002/FR-003 are unit-proven at the loop seam.
- `main()`'s `git fetch --prune origin` wiring and the uncanaried path are
  typechecked, not executed against a live GitHub remote.
- FR-005 proves non-behavior-change by the byte-green criterion only.
- Hard constraint 1 untouched: auto-merge gating unchanged; this repo still never
  auto-merges itself.

## Remaining risks

Deferred follow-up backlog (owners recorded in review.md): spec-text amendment for
the two premise corrections; `syncMainToOrigin` seam reuse; preflight/verification
sandbox teardown propagation (same class as FR-003, out of scope); override-path
`teardownFailure` line; uncanaried @-notification (needs own FR); axis-4 judgment
calls; WI-6 carried items. None material to WI-7's claims.

## Review status

Four-axis code review at `391d2de...4065fc7` (review.md, `b6c81d1`): standards PASS
(1 blocker resolved), specification PASS (0 blockers, 3 adjacent reconciled),
evidence SOUND (0 blockers, 3 adjacent), complexity PASS (1 blocker resolved, 5
adjacent). Both blockers resolved at `22db046` with fresh green gates; zero
assertion edits in the delta. No open blockers; no unverified gaps.

## Branch and base

Branch `worktree-wi-7` (worktree `.claude/worktrees/wi-7`), base `main` @ `391d2de`.
Default target repo remote: `manjula25/software-factory-loop` (per WI-6 delivery
precedent).

## Commit range

`391d2de..b6c81d1` — 20 commits: 5 planning + 1 header normalization + 5 task + 5
evidence + completion verification + 2 review-blocker fixes + review record + this
delivery record (committed after this file is finalized). 18 files, +2296/−231.

## Requested external actions

**Pending user authorization.** Prepared (not executed):
1. Push: `git push -u origin worktree-wi-7` (from this worktree).
2. PR: `gh pr create --base main --head worktree-wi-7` with title
   `WI-7: post-WI-6 hardening & cleanup — acquisition refresh, uncanaried-merge surface, canary teardown recording, negative-path pins, refactor batch`
   and a body summarizing the five FRs, evidence boundary, and review status.
3. Merge: NOT requested/not applicable — this repo never auto-merges itself; a
   human merges (hard constraint 1).

## Executed external actions and observed results

Authorized by the user 2026-09-19 (push + PR; merge explicitly stays human):

1. **Push** — `git push -u origin worktree-wi-7`: new branch on origin, tracking
   set. Observed: `* [new branch] worktree-wi-7 -> worktree-wi-7`.
2. **PR** — `gh pr create --base main --head worktree-wi-7` with the prepared
   title/body: observed **https://github.com/manjula25/software-factory-loop/pull/11**.

## Pending actions

Merge of PR #11 — human-only by hard constraint 1; not requested and not performed.
Post-delivery cleanup (worktree/branch removal after merge) needs explicit
instruction in a later session.
