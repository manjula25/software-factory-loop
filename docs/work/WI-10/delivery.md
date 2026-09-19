# Delivery — WI-10 (red-canary/revert live proof)

## Work item

WI-10: one live single-issue run (real LLM, local Docker) of the delivered
harness tree against `manjula25/loop-fixtures-py`, with an
orchestrator-timed conflicting-test push racing the merge — live-proving
the opt-in chain's canary-red compensating controls (auto-revert, run
halt, @-notify) on the current tree.

## Summary

One dormant bug (`to_cents`) seeded with one open issue (#26) and a
prepared-but-unpushed contract test pinning the buggy behavior. The live
run's fix passed fresh-sandbox verification on its branch (which lacked
the contract test), was approved by the pre-merge diff review, and
squash-merged onto raced `main` — where the canary suite went red on
exactly the two contract tests. The compensating controls fired live:
revert `b113686` on `main`, run halt, `@manjula25 ⚠️ REVERTED` comment on
PR #27. Issue #26 deliberately left open (stop-at-revert decision). Spend:
1 probe + 1 fix run, 0 triage, 0 retries — under the approved ceiling on
attempt 1. No harness `src/` changes.

## Plan artifacts

`docs/work/WI-10/`: prd.md (carve-out), slices.md, specification.md
(approved 2026-09-19 with three design decisions), implementation-plan.md,
implementation-notes.md, verification.md, review.md, evidence/ (t1-seed.md,
run.log, run-endstates.md).

## Verification

Fresh at delivery candidate `7b0eb53` (2026-09-19): `npm run typecheck`
exit 0; `npm test` 10 files / 216 tests exit 0; clean tree. Completion
verification recorded at `690f94a` (commits after it add only this work
item's own records): fresh gates, fresh gh read-backs (#26 OPEN, #27
MERGED, notify comment verbatim, fixtures main `b113686` four-commit
linear history, contract test present / repro test absent, 25 passed on
reverted main), spend ledger, non-claims.

## Evidence boundary

Runtime/external evidence: live Docker run (verbatim log committed),
fresh gh read-backs at verification time, and reviewer-independent live
re-verification of every external end-state. External evidence (issue,
PR, comment, merge/revert history on `manjula25/loop-fixtures-py`) is
durable on GitHub; the committed record carries the read-backs and the
verbatim log.

## Non-claims

The red canary was induced by an orchestrator-manufactured race, not a
naturally occurring developer mistake. The uncanaried-merge and
teardown-failure surfaces were not exercised live (unit evidence from
WI-7/WI-8 stands). The reverted run's true CLI exit code was not captured
(tee-pipeline masking; exit-1 behavior stands on unit evidence).
Invocation counts, not cost figures. No cloud; self-authored synthetic
data only (constraint 3).

## Remaining risks

Deferred to the backlog with owner: stale `origin/fix/gh-{1,2,3,10}`
fixtures branches; the fixtures repo's deliberately untidied end-state
(issue #26 open + contract test pinning the buggy behavior) awaits human
or future-work-item resolution; WI-9/WI-10 review adjacent findings.

## Review status

Four-axis review at `effb6e3`: all PASS, zero blocking findings, three
adjacent/minor findings recorded in review.md for the backlog (record
committed at `7b0eb53`).

## Branch and base

Branch `worktree-wi-10` (worktree `.claude/worktrees/wi-10`), base
`main`. `origin/main` = `93ec308`; local `main` additionally carries the
WI-10 planning commits (`f97e587..9fc072b`), never pushed — the PR
includes both the planning artifacts and the evidence/verification/review
commits.

## Commit range

`93ec308..7b0eb53` — 10 commits: 4 planning (carve-out+slices, spec
draft, spec approval, plan, post-ponytail) + 4 evidence/verification +
1 review + 1 delivery record.

## Requested external actions

Pending owner decision: push `worktree-wi-10` to origin and open a PR to
`main`. Merge stays human (constraint 1 — this repo never auto-merges
itself).

## Executed external actions and observed results

None yet (updated with observed results after any authorized action).

## Pending actions

- Owner authorization for push + PR (or instruction otherwise).
- Post-merge cleanup (worktree/branch removal, fast-forward local main) —
  only after the human merge, per WI-8/WI-9 precedent.
