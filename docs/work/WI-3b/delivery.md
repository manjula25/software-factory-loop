# Delivery

## Work item

WI-3b — WI-3 follow-up fixes: `.loop-harness` nesting guard, collision-proof
slug ids, onboarding fresh-fork + green-repo acceptance, fixtures-profile
refresh. Origin: the user's direction 2026-09-18 ("fix those before moving
on") over the substantive items in WI-3's follow-up queue.

## Summary

Attachment delivery now refuses loudly (queue-level, zero sandbox/agent
spend) when the target repo's `main` has `.loop-harness` committed — the
diagnosed root cause of the `.loop-harness/.loop-harness/` nesting (GNU
`cp -R` into an existing dest), with remediation named in the message.
Duplicate-slug counters use `--N` (slugify output never contains `--`),
so counter ids can no longer collide with literal "Foo 2"-style ids
(FR-005/006 revision noted in the WI-3 spec). Onboarding forks fresh per
run (deletes a persisted `loop/onboard` first) and accepts green repos via
an execution-evidence guard (`parseSuiteBaseline` throws
`SuiteDidNotRunError` only when no pytest summary ran) — both defects
reproduced live and fixed. The fixtures repo is remediated (`009a404`
pushed: `.loop-harness` untracked + gitignored) and its profile refreshed
with the correct empty baseline, proven live in Docker with zero LLM spend.

## Plan artifacts

`docs/work/WI-3b/`: `implementation-notes.md` (diagnosis, dispatch records,
TDD evidence, both review verdicts per checkpoint, follow-up queue 1–9),
`verification.md`, `review.md`, `delivery.md` (this file). No
prd/slices/spec — WI-3b is a follow-up work item; its requirements are the
recorded briefs, traced to WI-3's follow-up queue and the PRD's hard
constraints.

## Verification

Fresh against final head `051495a` (code identity `d60e041`; commits above
it docs-only): typecheck exit 0; `npm test` 10 files / 137 tests (baseline
129 at `f53be15`); working tree clean. Live end-to-end onboarding proof and
fixtures remediation outputs recorded in `verification.md`.

## Evidence boundary

Unit (vitest) + runtime (three live Docker onboarding runs — two defect
reproductions, one clean green proof) + external repo write (fixtures
`009a404`, pushed with prior user consent as part of the remediation) +
human review (pending, by design). No client data touched (hard
constraint 3).

## Non-claims

No live fix-run against a committed-`.loop-harness` repo observed the guard
firing (unit-pinned; the fixtures repo no longer exhibits the condition by
design). The branch-delete failure path (preserved worktree holding
`loop/onboard`) is logic-reviewed only. The nesting diagnosis rests on
preserved worktree artifacts + pinned-dist reading, not a synthetic
reproduction.

## Remaining risks

The follow-up queue (implementation-notes items 1–9) is non-blocking; the
notable ones: the guard fires after the attachment fetch (network side
effect on a doomed run), the `git branch -D` catch is broad (narrowing or
post-verification queued), and `SUMMARY_TOKEN` vs `SUITE_SUMMARY_RE`
disagree on what counts as a suite summary (skipped-only edge).

## Review status

Two-axis branch code review (`review.md`, fixed point `f53be15`):
Standards — 0 hard violations (CLAUDE.md module-table clause soft breach
resolved in-PR); Spec — PASS, 0 blocking. Both checkpoints (T1 `02e8064`,
T2 `d60e041`) passed sequential spec + quality reviews on pinned
identities.

## Branch and base

`worktree-wi-3b` → `main` on `manjula25/software-factory-loop` (origin;
never a bitcot repo). Base commit `f53be15`.

## Commit range

`f53be15..051495a` — 7 commits (3 code + 4 evidence/docs); 12 files,
+597/−22.

## Requested external actions

Push `worktree-wi-3b` to origin and open a PR to `main` on
`manjula25/software-factory-loop`. **Authorization pending** — exact scope
stated in conversation 2026-09-18; awaiting the user's explicit yes. Merge
NOT requested and NOT performed (hard constraint 1).

## Executed external actions and observed results

- (fixtures repo, earlier with user consent) `git push` of `009a404` to
  `loop-fixtures-py` main — observed: fast-forward, working tree clean
  after.

## Pending actions

- Explicit authorization → push + PR (commands prepared below).
- Human review + merge of the PR (terminal for the harness; never
  auto-merged).
- Post-merge cleanup when the user chooses: remove worktrees
  `.claude/worktrees/wi-3` and `.claude/worktrees/wi-3b` and their
  branches (PRs #6 and this one merged).

## Prepared commands (NOT executed)

1. `git push -u origin worktree-wi-3b`
2. `gh pr create --repo manjula25/software-factory-loop --base main
   --head worktree-wi-3b --title "WI-3b: nesting guard, collision-proof
   slug ids, onboarding fresh-fork + green-repo acceptance" --body <…>`
   (body: the summary above + review/verification pointers, ending with
   the Claude Code attribution line)
