# Delivery

## Work item

WI-6 — opt-in auto-merge of verified fix PRs, under the WI-5-approved PRD amendment
(opt-in flag, pre-merge review pass, post-merge canary, auto-revert/halt/@-notify,
merged-PR dedup with revert re-queue, gh-issue closing).

## Summary

On repos that opted in at onboarding (`--auto-merge` → `autoMerge: true` in the
profile — the only write path; the harness's own repo never sets it), every verified
fix PR now runs: one bounded cheap-model pre-merge diff review (non-approve → PR
stays open for a human, skip reason commented) → squash-merge (`--delete-branch`) →
post-merge canary: fresh-sandbox full suite on synced merged main → green: close the
gh-sourced issue with an evidence comment; red: auto-revert the merge, halt the run
(failureKind "harness", exit 1), @-mention the profile's `notifyHandle` on the merged
PR. Queue acquisition dedups against merged PRs too, with a revert guard
(`mainRevertsPr`) that re-queues issues whose fix was reverted. Non-opted repos are
behaviorally unchanged except: merged-covered issues are also skipped (`--issue N`
override included), and the queue summary gains a `skipped-merged: N` segment.

## Plan artifacts

`docs/work/WI-6/`: `prd.md` (carve-out), `slices.md`, `specification.md` (FR-001…FR-010,
owner-approved 2026-09-18), `tickets/`, `implementation-plan.md` (rev `b8ec2a1`,
post-ponytail), `implementation-notes.md` (T1–T7 + T4b checkpoints, deviations,
follow-ups), `verification.md` (per-task + final completion + post-review delta),
`review.md` (two-axis code-review record), `evidence/` (T7 live logs: green chain,
canary-red driver + log, re-queue proof + log).

## Verification

Fresh at the delivered candidate: `npm run typecheck` exit 0; `npm test` 10 files /
195 tests, exit 0 (post-review delta section of `verification.md`, re-run after the
review-blocking fixes in `235c1bc`). Pipeline evidence live against
`manjula25/loop-fixtures-py` in local Docker (T7): green chain (PR #17 merged
`88984fd`, canary green, issue #14 closed with evidence comment), canary-red chain
zero-LLM (PR #19 merged → canary red on a contract test → revert `eecb13a` pushed →
`@manjula25` comment verified via `gh api` → queue aborted, exit 1, issue #18 left
open), re-queue proven through real acquisition + `splitQueue` after the revert.

## Evidence boundary

Harness-source claims are proven by vitest at the public seam (195 tests). The
canary-red chain was driven by a zero-LLM driver (`evidence/canary-red-driver.ts`)
stubbing exactly four seams (`runFixRun` — pre-authored branch, `runReview` — fixed
approve, `listFixBranches`, `runTriage`); everything else (gh acquisition/dedup,
Docker preflight/verification/canary sandboxes, git push/PR/merge/revert, gh comment)
ran the real production wiring. The pre-merge review pass itself was live-exercised
once with a real bounded model call (T6, verdict approve, ~19 s).

## Non-claims

- ~~No real agent-authored fix ran through the canary-red path (pre-authored
  branch stands in)~~ — **closed 2026-09-19:** T7b re-ran the canary-red chain
  through the production CLI with zero stubs and a real agent-authored fix
  (PR #21, merged `1d920fa` → canary red → revert `c618b3b` → @-notify → halt,
  exit 1; re-queue proven; `verification.md` T7b). No merger-agent conflict
  resolution exercised.
- `mainRevertsPr` reads the local `origin/main` tracking ref without its own fetch —
  a stale clone can misjudge re-queue until any fetch refreshes it
  (`syncMainToOrigin` prunes+fetches after every successful auto-merge).
- A thrown `syncMain` (divergent main, git failure) propagates uncaught: loud exit 1,
  but no revert/comment/REVERTED summary, and an uncanaried merge stays on main
  (plan-D3 prescribes throw-on-divergence — a plan tension, recorded).
- Stale `origin/fix-*` refs left by HUMAN merges + manual remote branch deletion on
  non-opted repos are a pre-existing out-of-scope condition.
- The revert matcher marks a PR reverted forever, even after a human re-merges the
  same fix (spec-silent; future work item).
- No lint surface exists; nothing is claimed about style beyond the review records.
- Cloud sandboxes unclaimed (constraint 6 — local Docker only). Fix-run token usage
  is not precisely metered by the POC.

## Remaining risks

All recorded follow-ups live in `implementation-notes.md` (per checkpoint) and
`review.md` (triage table); the deferred set: `mainRevertsPr` fetch freshness,
syncMain-throw surface, human-merge stale refs (above), guard-ordering negative
test, throw-path `loop/review` deletion test, fetch-ref divergence test,
`CANARY_RED_*` dedup, `advanceUpstream()` / `runPreMergeReview()` / `runCanary()`
extractions, `BoundedRunOptions` type, `covers`/`valuelessFlag` helpers,
`OPEN_PR_PAGE_LIMIT` rename, `autoMerge` doc-comment wording. None blocking.

## Review status

Two-axis `code-review` complete (`review.md`): Standards — 2 actionable findings
(unguarded override-path emission; stale CLAUDE.md module row), both **fixed** in
`235c1bc` and verified fresh; Spec — 0 blocking, 3 notes triaged (1 deferred with
owner, 2 recorded analyses). Per-checkpoint specification + code-quality reviews
approved at every implement checkpoint (implementation-notes.md). No blocking
findings remain.

## Branch and base

Branch `worktree-wi-6` (worktree `.claude/worktrees/wi-6`), base `main` @ `3064cef`.
No upstream configured — the branch has never been pushed.

## Commit range

`3064cef..798c294` — 18 commits, 32 files, +4165/−47. Oldest: `749b132` (planning
inputs); newest: `798c294` (code-review record). No open PR exists for this head.

## Requested external actions

None authorized yet. Prepared (not executed) options:

1. **Push the branch:**
   `git push -u origin worktree-wi-6`
2. **Open the PR** (base `main`, head `worktree-wi-6`) — prepared title/body held
   ready on authorization.

## Executed external actions and observed results

Authorized by the user 2026-09-18 ("Push + open PR"), executed and observed:

1. `git push -u origin worktree-wi-6` → `* [new branch] worktree-wi-6 ->
   worktree-wi-6`, upstream set.
2. `gh pr create --base main --head worktree-wi-6 …` →
   **https://github.com/manjula25/software-factory-loop/pull/10**, read back
   `gh pr view 10`: state OPEN, base main, head worktree-wi-6, 19 commits.

No merge performed — a human merges this PR (the harness's own repository never
auto-merges, constraint 1). WI-6's live-pipeline evidence touched only the fixtures
repo `manjula25/loop-fixtures-py` (during implementation, already cleaned up).

## Pending actions

- Human review + merge of PR #10.
- Post-merge: worktree removal + branch cleanup per `using-git-worktrees`
  convention — not executed automatically.
