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
pre-merge review; green → the resolved branch is published to origin before `mergePr` (T12);
red or failed publish → PR open + `mergeFailure` note, queue continues. Docs updated in the
same branch (CLAUDE.md module rows, `docs/agents/workflow.md`).

## Plan artifacts

`docs/work/WI-13/`: `prd.md`, `slices.md`, `specification.md`, `implementation-plan.md`,
`implementation-notes.md` (controller ledger T1–T12 + adjacent findings A1–A56),
`evidence/live-run.log`, `evidence/merger-live-run{,-2,-3,-4}.log`,
`evidence/verification/` (typecheck, npm-test, smoke-image logs),
`verification.md` (fresh at `3828c21` + T11/T12 amendments), `review.md` (code review +
resolution addendum), `delivery.md` (this file).

## Verification

Fresh at candidate `7733c1f` (post-T12): typecheck exit 0; `npm test` **261/261** (baseline
223 at branch start); `npm run smoke:image` **9/9**. Pipeline integration: original live run
green end-to-end (planner graph as seeded, two concurrent lanes, PRs #33/#34, serialized
merges + green canaries, same-run re-plan, gh-31 → PR #35, 3/3 fixed, exit 0; GitHub
end-state verified). Merger-gate live evidence: run 3 fired the conflict path and exposed the
publish defect (safely — PR open, loud failure); run 4 at the T12-fixed source proved the
gate's complete happy path green end-to-end — conflict probed, merger resolved, re-verified
green, resolved branch published, review approved, PR #51 merged @ `12758a1`, canary green,
issue closed, 2/2 fixed, exit 0; combined behavior + both permanent regression tests verified
on fixtures main. Full record: `verification.md`.

## Evidence boundary

The original live run was recorded at pre-T11 source `687e89b` (T11's halt check activates
only after a harness-level outcome, which that run had none of). The merger-gate live runs 3–4
were recorded on scratch branch `scratch/wi-13-gate-live{,-2}` — PR-#17 code plus a 9-line
env-gated `LOOP_BYPASS_PLAN=1` planner bypass (never merges; forces the production
degraded-fallback path so both lanes run concurrently in wave 1; not a flag — FR-009). Run 4's
source is exactly the delivered T12 fix (`7733c1f`) plus that bypass. Harness-source evidence
is dep-injected vitest at the public seam. Local Docker only (constraint 6).

## Non-claims

Merger-gate live evidence is ONE deliberately-conflicting pair per run under the planner
bypass — no claim about the planner's own behavior on overlapping fixes (it serialized such
pairs twice, runs 1–2, defensibly). One fixtures repo, one provider — no claim about other
repos/providers/scale. No live non-opted-in run. No CI/lint (none exists)/cloud claims. The
T11 halt behavior is proven at the harness-source seam only (no live harness-level failure was
triggered).

## Remaining risks

1. Early-harness-outcome halt arm degrades to wave-granularity (merge on valid main only;
   spec-adjudicated within FR-004's letter — A48, comment honesty owed next touch).
2. Concurrency pinned at the dep-call seam + live runs of 3 and 2 issues; heavier parallelism
   unproven.
3. Adjacent backlog A1–A56 (taste/test/docs items) — none blocking; candidates for a future
   test-only/docs slice.
4. Owner adjudication pending: FR-008 spec-internal tension (infra failure at the merger
   gate: issue-level vs harness-level — spec line is self-contradictory); A45 (stale base
   sentence in hard-constraint 5, grilling territory).

## Review status

Per-task dual reviews (spec → quality) at every checkpoint T1–T12, all accepted; one blocking
verdict (T6) and one work-item code-review blocking verdict (FR-004) — both resolved through
controller fix passes with dual reviews re-run on the new identities; the live-found T12
defect likewise fixed and dual-reviewed. Final code review (`review.md`): Standards
**pass-with-findings** (6 adjacents), Spec **fail → resolved** (blocking FR-004 fixed in T11;
resolution addendum recorded; remaining findings adjacent). Verification fresh at the
delivered source.

## Branch and base

Branch `worktree-wi-13` (worktree `.claude/worktrees/wi-13`); base `main` @ `61b90e2`.
Target: PR to `manjula25/software-factory-loop` `main`. Human merge only — this repo never
auto-merges itself (constraint 1).

## Commit range

`61b90e2..8cc96bd` initially delivered (25 commits); extended post-review by T11 (2 commits),
the merger live-run evidence (4 commits), and T12 (2 commits) — PR #17 now carries
`61b90e2..HEAD`.

## Requested external actions

Owner authorized (2026-09-20, via AskUserQuestion): push branch + open PR.
Owner authorized (2026-09-20, "proceed with all three"): T12 fix pass pushed to PR #17;
out-of-band completion of fixtures PR #47; one further bypassed live run.

## Executed external actions and observed results

- **Push** `worktree-wi-13` → origin: executed 2026-09-20; observed `* [new branch]
  worktree-wi-13 -> worktree-wi-13`, upstream set. (Commit range delivered as
  `61b90e2..263a072` — 26 commits, including this delivery record's parent; delivery.md's
  own commit `263a072` is included.)
- **PR** `worktree-wi-13` → `main` on `manjula25/software-factory-loop`: executed
  2026-09-20; observed **https://github.com/manjula25/software-factory-loop/pull/17**.
- **Pushes to PR #17** (T11 `3828c21` chain, merger-run evidence, T12 `1da7936` + docs
  `7733c1f`): executed 2026-09-20; observed fast-forwards on origin.
- **Fixtures PR #47 out-of-band completion** (user-authorized): resolution `3972f87` pushed
  to `origin/fix/gh-44`; PR #47 squash-merged as `052c5bf` (content verified identical to
  the branch pre-delete); issue #44 closed with an explanatory comment; fixtures local main
  synced and branch cleaned up.
- **Merger live runs 1–4** (user-authorized seeding + model spend; runs 3–4 on scratch
  branches with the `LOOP_BYPASS_PLAN=1` bypass, never merged): run 4 green — PRs #50/#51
  merged with green canaries, issues #48/#49 closed; verbatim logs under `evidence/`.

## Pending actions

- Human review + merge of PR #17 (owner; this repo never auto-merges itself).
- Worktree/branch cleanup after merge, and deletion of scratch branches
  `scratch/wi-13-gate-live` and `scratch/wi-13-gate-live-2` (needs explicit authorization;
  exact commands will be provided at that point).
