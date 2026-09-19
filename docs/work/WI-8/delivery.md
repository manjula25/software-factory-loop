# Delivery

## Work item

WI-8 — failure-surface parity batch (carved from the WI-7 follow-up backlog:
preflight/verification teardown item, single-issue teardown omission, uncanaried
@-notification).

## Summary

Three failure surfaces brought to the posture the already-fixed surfaces hold:

- **FR-001** — teardown failures at the preflight and verification sandboxes are
  caught and recorded beside the outcome (`LoopOutcome.teardownFailure`), never
  deciding or erasing it: a green verification + open PR survives a close()
  throw; a stale-baseline abort keeps its reason; a green baseline with a
  preflight teardown failure still reaches the fix run; the queue FAILED line
  carries a strictly conditional `(teardown: …)` suffix.
- **FR-002** — the `--issue` single-issue path names a recorded teardown failure
  on guarded stderr (`sandbox teardown failed: …`, both PR'd and no-PR branches,
  terminal line only — exit code unchanged, per the approved decision). The
  print block moved verbatim into the exported pure builder
  `formatSingleIssueResult`; `main()` emits through the per-line
  `assertNoSecrets` guard.
- **FR-003** — an uncanaried merge's PR comment pings the configured notify
  handle (`cc @<handle> — this merge needs a human decision.`, best-effort,
  human-decision sentence verbatim) and the shared uncanaried detail states the
  notify posture unconditionally in the reverted path's vocabulary. Hard
  constraint 1's compensating control extended to its sibling case; no new
  notification channels; halt/no-blind-revert/merge untouched.

## Plan artifacts

`docs/work/WI-8/`: `prd.md` + `slices.md` (traceability carve-outs),
`specification.md` (3 FRs, owner-approved 2026-09-19 incl. both design
decisions), `implementation-plan.md` (post-ponytail), `implementation-notes.md`
(3 accepted checkpoints), `verification.md` (per-task + completion records),
`review.md` (four-axis code review + B1 resolution), this `delivery.md`.

## Verification

Completion verification fresh at code candidate `112800e` (2026-09-19): full
`npm test` 10 files / 216 tests exit 0 (baseline 207 + 9 new); focused
`src/loop.test.ts` 108/108; `npm run typecheck` exit 0; clean tree. Gates
re-run green at the branch head `b9adabe` (docs-only delta since `112800e`).
Per-checkpoint evidence: genuine behavioral RED at every step (raw throws /
missing lines / missing mention), fresh controller gates at each candidate,
sequential spec-PASS + quality-APPROVED reviews at each fixed package.

## Evidence boundary

Vitest public-seam suite + tsc only, in the worktree, local machine. Teardown
failures exercised via throwing-dep knobs (WI-7 FR-002/FR-003 idiom); the
uncanaried path via the throwing `syncMain` knob. `main()`'s emit loop is
typechecked + seam-verified (builder unit-proven), not CLI-executed.

## Non-claims

No Docker/gh/pipeline-integration run of any WI-8 behavior; teardown not
retried; no new notification channels; no exit-code change; no queue-mode
output change beyond the FR-001 FAILED-line suffix; hard constraints 1–6
untouched (auto-merge gating unchanged; this repo still never auto-merges
itself — the PR below is merged by a human).

## Remaining risks

None within the claimed boundary. Deferred/adjacent (recorded in `review.md`
and `verification.md`, owned by the follow-up backlog): pipeline-integration
run; cleanup & docs batch; canary-wins teardown precedence;
`fail()`-path `sandboxTeardown` drop (sanctioned); reverted-path notify
vocabulary mismatch (pre-existing); cross-stream emit ordering; stale WI-6
comment wording; teardown-shape/template duplication (taste, revisit at n=3).

## Review status

Four-axis code review at `3c3f214..6a2047f`: specification fidelity PASS,
evidence & risk integrity PASS (reviewer independently re-ran gates green),
unnecessary complexity PASS; repository standards FAIL on one blocking finding
(B1: CLAUDE.md module-table same-PR rule) — **resolved** at `b9adabe` (docs
row amended, gates re-run green). No open blocking findings. Per-checkpoint
spec/quality reviews: all PASS/APPROVED at pinned packages.

## Branch and base

Branch `worktree-wi-8` (worktree `.claude/worktrees/wi-8`); base `main` @
`3c3f214` (= `origin/main`), ancestry verified.

## Commit range

`3c3f214..b9adabe` — 15 commits: 3 code (`a30c4ac` FR-001, `8b4ff3f` FR-002,
`e845f89` FR-003), 1 CLAUDE.md review-fix (`b9adabe`), 11 planning/evidence
docs.

## Requested external actions

Authorized by owner (2026-09-19, via the delivery question): push branch to
origin + open PR against `main`. Merge stays human (hard constraint 1).

## Executed external actions and observed results

- `git push -u origin worktree-wi-8` — new branch `worktree-wi-8` on
  `origin` (github.com:manjula25/software-factory-loop.git), tracking set.
  Observed in push output.
- `gh pr create --base main --head worktree-wi-8` — **PR #12**:
  https://github.com/manjula25/software-factory-loop/pull/12. Observed URL
  in command output.

## Pending actions

- Human merge of PR #12 (constraint 1 — the harness never merges itself).
- After merge (on request): worktree/branch cleanup.
- Follow-up backlog items remain recorded in `review.md` / `verification.md`,
  not scheduled.
