# Delivery — WI-9 (live pipeline-integration run)

## Work item

WI-9: one live queue run (real LLM, local Docker) of the delivered harness
tree against `manjula25/loop-fixtures-py`, driving two seeded issues through
the complete opt-in auto-merge chain — closing the standing
pipeline-integration non-claim.

## Summary

Two dormant bugs (`clamp`, `mean`) seeded in one new fixtures module with two
open self-authored issues (one carrying a messy inline log). Run 1 (with
triage): gh-22 fixed by a real LLM fix run, fresh-sandbox verified, PR #24
squash-merged, canary green, issue closed; gh-23 deferred for file overlap
with the reason in the run output. Run 2: the deferred issue re-admitted and
completed the same way (PR #25, canary green, issue closed). Final
fresh-clone proof: both fixes and both reproduction tests on merged main,
23 passed. Spend exactly 1 probe + 1 triage pass + 2 fix runs, zero retries.
No harness defects surfaced (conditional defect path never triggered); zero
`src/` changes — the work item is evidence and planning artifacts only.

## Plan artifacts

`docs/work/WI-9/`: prd.md (carve-out), slices.md, specification.md (approved
2026-09-19 incl. both design decisions), implementation-plan.md,
implementation-notes.md, verification.md, review.md, evidence/ (t1-seed.md,
run1.log, run2.log, run1-endstates.md, run2-endstates.md).

## Verification

Fresh at delivery candidate `2cb66c8` (2026-09-19): `npm run typecheck`
exit 0; `npm test` 10 files / 216 tests exit 0; clean tree. Completion
verification recorded at `3aaecad` (one commit earlier — the only change
since is this work item's review.md): fresh gates, fresh gh end-states
(#22/#23 CLOSED, #24/#25 MERGED), fixtures main `b46c9ef` on `5f372b6` on
seed `88a18c3`, spend ledger, non-claim closure.

## Evidence boundary

Runtime/external evidence: live Docker runs (verbatim logs committed),
fresh gh read-backs at verification time, and reviewer-independent live
re-verification of all external end-states. The external evidence (issues,
PRs, merges on `manjula25/loop-fixtures-py`) lives on GitHub and is durable
there; the committed record carries the read-backs and verbatim logs.

## Non-claims

Failure-path surfaces (teardown throws, uncanaried merge, revert-on-red)
not exercised live — no fault injection, none arose (both canaries green);
naturally-red-canary path live-proven only on the older WI-6 T7 tree. Spend
claims are invocation counts, not cost figures. No cloud. Self-authored
synthetic data only (constraint 3).

## Remaining risks

Deferred to the backlog with owner: stale `origin/fix/gh-{1,2,3,10}`
fixtures branches; red-canary/revert live re-proof on the current tree;
WI-8-adjacent cleanup & docs batch (review's adjacent findings A1–A5, M1
fold in here).

## Review status

Four-axis review at `3aaecad`: all PASS, zero blocking findings, seven
adjacent/minor findings recorded in review.md for the backlog (record
committed at `2cb66c8`).

## Branch and base

Branch `worktree-wi-9` (worktree `.claude/worktrees/wi-9`), base `main`.
`origin/main` = `dd7a4d3`; local `main` additionally carries the WI-9
planning commits (`9502580..278bbf7`), never pushed — so the PR includes
both the planning artifacts and the evidence/verification/review commits
(11 total).

## Commit range

`dd7a4d3..2cb66c8` — 11 commits: 5 planning (prd/slices, spec draft,
spec approval, plan, post-ponytail) + 5 evidence/verification + 1 review.

## Requested external actions

Pending owner decision: push `worktree-wi-9` to origin and open a PR to
`main`. Merge stays human (constraint 1 — this repo never auto-merges
itself).

## Executed external actions and observed results

None yet (this record will be updated with observed results after any
authorized action).

## Pending actions

- Owner authorization for push + PR (or instruction otherwise).
- Post-merge cleanup (worktree/branch removal, fast-forward local main) —
  only after the human merge, per WI-7/WI-8 precedent.
