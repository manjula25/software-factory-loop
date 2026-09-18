# Delivery

## Work item

WI-4 — correctness batch from the WI-3b follow-up queue (items 1, 4, 6,
8, 9). Origin: user direction 2026-09-18 ("start the next work item from
the follow-up queue"), scope confirmed via the correctness-batch option
(cosmetics deferred).

## Summary

The nesting guard now refuses before the attachment fetch — refusal is
truly zero-side-effect (no fetch, no staged files, no sandbox, no spend),
with the accepted trade on record that all-fetches-failed runs now refuse
instead of proceeding body-only. Onboarding's `loop/onboard` deletion is
loud when the branch survives (probe + unguarded delete; absent stays
silent) — closing the one silent path back to stale-fork behavior; happy
path re-proven live in Docker. One shared `SUITE_SUMMARY_RE` in
`src/verify.ts` now governs the verification gate, onboarding, and the
preflight script, resolving their disagreement fail-safe; preflight also
gained the execution-evidence guard and argv-based repoDir (hardcoded
macOS path removed).

## Plan artifacts

`docs/work/WI-4/`: `implementation-notes.md` (scope, dispatch records, TDD
evidence, review verdicts, follow-up queue 1–9), `verification.md`,
`review.md`, `delivery.md` (this file). No prd/slices/spec — follow-up work
item; requirements are the recorded briefs traced to the WI-3b queue.

## Verification

Fresh against final head `369f248` (code identities `7687e9d`, `27421a6`,
`0990db8`): typecheck exit 0; `npm test` 10 files / 145 tests (baseline
137); clean tree. Live Docker proof of the onboarding happy path recorded
in `verification.md`. RED empirically re-verified for T1 and T3 by the
spec reviewers on throwaway clones; T2's mechanism check independently
reproduced.

## Evidence boundary

Unit (vitest) + runtime (live Docker onboarding run, zero LLM spend) +
git-mechanism experiments (throwaway repos, reviewer-reproduced) + human
review (pending, by design). No client data touched (hard constraint 3).

## Non-claims

No live preflight-check run (no test seam; its parsing is now the shared,
live-proven path). T2's pinned-branch loud path proven at the
git-mechanism level, not by wedging the fixtures clone's refs. The
skipped-only widening was analysed, not observed live.

## Remaining risks

Follow-up queue (9 non-blocking items) in implementation-notes; notable:
conditional gate-seam narrowing if a real repo ever yields a skipped-only
verification suite (item 8), verify.ts's mild Divergent Change (item 9,
record-only), assorted nits.

## Review status

Two-axis branch code review (`review.md`, fixed point `ce763cd`):
Standards — 0 hard violations; Spec — PASS, 0 blocking, scope discipline
verified. The one substantive flag (skipped-only widening vs. hard
constraint 2's spirit) answered with counter-analysis and a conditional
trigger queued. Every checkpoint (T1–T3) passed sequential spec + quality
reviews on pinned identities.

## Branch and base

`worktree-wi-4` → `main` on `manjula25/software-factory-loop` (origin;
never a bitcot repo). Base commit `ce763cd`.

## Commit range

`ce763cd..369f248` — 9 commits (3 code + 6 evidence/docs); 12 files,
+524/−41.

## Requested external actions

Push `worktree-wi-4` to origin and open a PR to `main` on
`manjula25/software-factory-loop`. Explicitly authorized by the user
2026-09-18 ("yes, push and open the pr") after the exact scope was stated
in conversation. Merge NOT requested and NOT performed (hard constraint 1).

## Executed external actions and observed results

- `git push -u origin worktree-wi-4` (2026-09-18, authorized) — observed:
  `* [new branch] worktree-wi-4 -> worktree-wi-4`, tracking set.
- `gh pr create --repo manjula25/software-factory-loop --base main --head
  worktree-wi-4` (2026-09-18, authorized) — observed URL:
  https://github.com/manjula25/software-factory-loop/pull/8

## Pending actions

- Human review + merge of PR #8 (terminal for the harness; never
  auto-merged).
- Post-merge cleanup when the user chooses: remove worktree
  `.claude/worktrees/wi-4` and its local/remote branches.
