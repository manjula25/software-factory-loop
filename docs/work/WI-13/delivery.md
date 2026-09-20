# Delivery — WI-13

## Work item

WI-13: dependency-aware parallel queue (Sandcastle model). Spec
`docs/work/WI-13/specification.md` (FR-001..FR-011), approved 2026-09-19; grilling record
`docs/work/WI-13/prd.md` (also amends CLAUDE.md hard constraints 1 and 5, owner-approved).

## Summary

Replaces the triage-based sequential queue with a planner pass and a concurrent wave runner:
one `runPlan` call whenever >1 issue is eligible (priority + `blockedBy` edges in a `<plan>`
block, cycle/edge validation, deterministic fallback on an unusable plan); concurrent lanes
via `Promise.allSettled` with stop-the-line preserved — abort raised after wave collection,
merges stopped at the first harness-level outcome by a run-level halt signal (T11 fix);
`--max-issues` optional ceiling (absent = all unblocked the plan surfaced); `--triage`
retired with a loud startup error; per-run shared-git mutex serializing the review→merge→
canary chain; and, on opted-in repos only, a verified merger gate — read-only `git
merge-tree` conflict probe → bounded merger run → fresh-sandbox re-verification BEFORE the
pre-merge review (red → PR open + `mergeFailure` note, queue continues). Docs updated in the
same branch (CLAUDE.md module rows, `docs/agents/workflow.md`).

## Plan artifacts

`docs/work/WI-13/`: `prd.md`, `slices.md`, `specification.md`, `implementation-plan.md`,
`implementation-notes.md` (controller ledger T1–T11 + adjacent findings A1–A53),
`evidence/live-run.log`, `evidence/verification/` (typecheck, npm-test, smoke-image logs),
`verification.md` (fresh at `3828c21` + T11 amendment), `review.md` (code review + resolution
addendum), `delivery.md` (this file).

## Verification

Fresh at candidate `3828c21` (post-T11): typecheck exit 0; `npm test` **259/259** (baseline
223 at branch start); `npm run smoke:image` **9/9**. Pipeline integration: live run green
end-to-end against seeded fixtures repo in local Docker — planner graph as seeded, two
concurrent lanes, PRs #33/#34, serialized merges + green canaries, same-run re-plan, gh-31 →
PR #35, merge + green canary, summary 3/3 fixed, exit 0; GitHub end-state verified (issues
#29–#32 closed, PRs #33/#34/#35 merged with OIDs byte-identical to the log). Full record:
`verification.md`.

## Evidence boundary

Live-run evidence was recorded at pre-T11 source `687e89b`; T11 adds only a merge-chain halt
check that activates exclusively after a harness-level outcome, and the green live run had
none — executed path behavior-identical, but no fresh live run was performed at `3828c21`
(stated boundary in `verification.md`'s T11 amendment). Harness-source evidence is
dep-injected vitest at the public seam. Local Docker only (constraint 6).

## Non-claims

No live exercise of the merger conflict path (no conflict arose; vitest-only coverage — A46).
One fixtures repo, one provider, 3 issues — no claim about other repos/providers/scale. No
live non-opted-in run. No CI/lint (none exists)/cloud claims. The T11 halt behavior is proven
at the harness-source seam only.

## Remaining risks

1. Merger gate conflict path unproven live (A46) — future live run with deliberately
   overlapping fixes.
2. Early-harness-outcome halt arm degrades to wave-granularity (merge on valid main only;
   spec-adjudicated within FR-004's letter — A48, comment honesty owed next touch).
3. Concurrency pinned at the dep-call seam + one 3-issue live run; heavier parallelism
   unproven.
4. Adjacent backlog A1–A53 (taste/test/docs items) — none blocking; candidates for a future
   test-only/docs slice.
5. Owner adjudication pending: FR-008 spec-internal tension (infra failure at the merger
   gate: issue-level vs harness-level — spec line is self-contradictory); A45 (stale base
   sentence in hard-constraint 5, grilling territory).

## Review status

Per-task dual reviews (spec → quality) at every checkpoint T1–T11, all accepted; one blocking
verdict (T6) and one work-item code-review blocking verdict (FR-004) — both resolved through
controller fix passes with dual reviews re-run on the new identities. Final code review
(`review.md`): Standards **pass-with-findings** (6 adjacents), Spec **fail → resolved**
(blocking FR-004 fixed in T11; resolution addendum recorded; remaining findings adjacent).
Verification fresh at the delivered source.

## Branch and base

Branch `worktree-wi-13` (worktree `.claude/worktrees/wi-13`); base `main` @ `61b90e2`.
Target: PR to `manjula25/software-factory-loop` `main`. Human merge only — this repo never
auto-merges itself (constraint 1).

## Commit range

`61b90e2..8cc96bd` — 25 commits (11 feature/fix, 14 docs/evidence).

## Requested external actions

(To be confirmed with the owner — preparing is not authority to execute.)

## Executed external actions and observed results

None yet.

## Pending actions

- Push branch `worktree-wi-13` to origin (needs explicit authorization).
- Open PR `worktree-wi-13` → `main` (needs explicit authorization).
- Worktree/branch cleanup after merge (needs explicit authorization; exact commands will be
  provided at that point).
