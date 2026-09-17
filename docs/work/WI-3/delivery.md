# Delivery

## Work item

WI-3 — attachment fetching + non-GitHub issue sources (PRD carve-out at
`docs/work/WI-3/prd.md`, resolved against `harness-prd-v2.md`).

## Summary

The loop now discovers `user-attachments` URLs in issue text for every source
and hard-gates them on the repo's third-party-API clearance (FR-001/002);
cleared issues get attachments fetched without auth headers, staged under
`.loop-harness/attachments/<id>/` with gitignore + prompt guards, delivered
into the sandbox as one top-level directory, and excerpted into the fix prompt
(FR-003); fetch failures degrade loudly in summary and PR body (FR-004).
Non-GitHub sources — `--spec-doc` and `--plain-list` — replace GitHub
acquisition with loud parse errors and flag-combination rejection, keeping
dedup/cap parity and a source-named summary (FR-005–008). The T7 review fix
closed a plain-list gate bypass (suffix URLs had escaped discovery while still
reaching the prompt).

## Plan artifacts

`docs/work/WI-3/`: `prd.md`, `slices.md`, `specification.md` (8 FRs),
`tickets/`, `implementation-plan.md`, `implementation-notes.md`,
`verification.md`, `review.md`, `evidence.md` + `evidence/` logs.

## Verification

Fresh against final code identity `01b2b04` (T7): typecheck exit 0;
`npm test` 10 files / 129 tests (baseline 72); clean tree; PRs #12/#13 on the
fixtures repo re-checked OPEN/unmerged. Full record with per-checkpoint
entries (T1, T2, T2b, T2c, T3, T4, T5, T5b, T6, T7) in `verification.md`.

## Evidence boundary

Unit (vitest) + runtime (three live Docker fixture runs in T6, logs preserved)
+ external read-only (PR states) + human review (pending, by design).

## Non-claims

No client repo or client data touched (hard constraint 3). No live plain-list
run — unit-pinned; its selection path is identical to the live-proven
spec-doc path. No provider-cost measurement in currency. Excerpt-in-prompt
verified at the unit seam, not from live prompt capture.

## Remaining risks

Fixtures PRs #12/#13 fix the same seeded bug from two sources — a human must
merge one and close the other (dedup is by issue id, not bug identity;
grilling question recorded). Deferred follow-ups in implementation-notes:
`.loop-harness/.loop-harness/` nesting diagnosis (before the next live-run
milestone), slug/suffix id-collision grilling (before FR-007 cross-source
dedup is relied on), comment-rationale wording, assorted minors.

## Review status

Two-axis code review (`review.md`): Standards — 1 hard violation (workflow.md
command list) + judgement-call smells; Spec — 1 blocking gate-bypass gap +
partials. Both blocking findings resolved by T7 (candidate `01b2b04`,
sequential spec PASS + quality APPROVED on that identity); resolution
recorded in `review.md`. Every checkpoint T1–T7 passed sequential spec +
quality reviews on pinned identities.

## Branch and base

`worktree-wi-3` → `main` on `manjula25/software-factory-loop` (origin; never
a bitcot repo). Base commit `bacb85a`.

## Commit range

`bacb85a..7731674` — 23 commits (10 code checkpoints + review fix, each
followed by its evidence/docs commit, plus the review record and the T7
evidence commit); 22 files, +2535/−38.

## Requested external actions

Push `worktree-wi-3` to origin and open a PR to `main` on
`manjula25/software-factory-loop`. Explicitly authorized by the user
2026-09-17 after the exact scope was stated in conversation. Merge NOT
requested and NOT performed (hard constraint 1: every PR awaits human review).

## Executed external actions and observed results

- `git push -u origin worktree-wi-3` → new remote branch created, tracking
  set (observed: `* [new branch] worktree-wi-3 -> worktree-wi-3`).
- `gh pr create --repo manjula25/software-factory-loop --base main --head
  worktree-wi-3` → observed URL: https://github.com/manjula25/software-factory-loop/pull/6

## Pending actions

- Human review + merge of PR #6 (terminal for the harness; never auto-merged).
- Human disposition of fixtures PRs #12/#13 (merge one, close the other).
- Optional later: the recorded non-blocking follow-up queue.
