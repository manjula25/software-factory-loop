# Delivery

## Work item

WI-2 — Queue ingestion (acquire open issues → dedup → capped admission → sequential run →
honest summary), carved from `harness-prd-v2.md` per `docs/work/WI-2/prd.md` and
`docs/work/WI-2/slices.md`.

## Summary

The harness now runs as a queue by default. One invocation acquires the target repo's open
GitHub issues (bounded one-page `--limit 30`, optional `--label`), deduplicates them against
open PRs (head branch `fix/<id>` or exact-token `\bgh-N\b` body match) while deleting stale
unowned `fix/*` branches locally and remotely, admits at most `--max-issues` (default 3,
validated at startup) — deterministically by ascending issue number, or via `--triage`, an
opt-in model pass whose output is Zod-validated and, when valid, ranks by score and defers
issues whose likely-touched files overlap an already-admitted issue's (decision 14) — then runs
each admitted issue through the WI-1 single-issue loop sequentially and prints a run summary
(attempted/fixed/failed/skipped-duplicate/not-admitted with reasons, PR URLs). `--issue N`
remains the single-issue override: no cap, no triage, dedup still applies. Harness-level
failures (stale baseline profile) abort the queue via a typed `failureKind: "harness"` on the
outcome; issue-level failures are recorded and the queue continues.

Owner-directed post-plan changes folded in before implementation: decisions 14 (file-overlap
deferral) and 15 (Zod-validated triage output, `zod ^4.6.5` direct dependency), adopted from
comparing our plan against Matt Pocock's Sandcastle; PRD, carve-out, slices, specification,
tickets t3/t4, and the implementation plan were amended accordingly.

## Plan artifacts

- `docs/work/WI-2/prd.md`, `slices.md` — carve-out and slices (amended for decisions 14–15)
- `docs/work/WI-2/specification.md` — FR-001–FR-006, approved 2026-09-15
- `docs/work/WI-2/tickets/` — t1–t5
- `docs/work/WI-2/implementation-plan.md` — TDD plan, post-ponytail (3 shrinks applied)
- `harness-prd-v2.md` — 2026-09-15 decisions 2 and 4 amended in place (owner-directed)

## Verification

Fresh for candidate `ecbaed8`: `npm test` 59/59 exit 0 (re-run 2026-09-15 14:31 after the
review-finding fixes), `npm run typecheck` clean, secrets scan over emitted artifacts clean.
Full record: `docs/work/WI-2/verification.md`. Three live runs against the seeded fixtures
repo (`manjula25/loop-fixtures-py`) exhibit the behavior end to end; logs in
`docs/work/WI-2/evidence/`.

## Evidence boundary

- Unit evidence covers the whole public surface: acquisition, dedup/token exactness, stale
  branch cleanup, admission (deterministic, triage-ranked, deferral, degrade), queue
  sequencing, harness-abort, override dedup, cap validation.
- Live evidence (runs a/b/c) was gathered at `cdc6439`; the only source change since
  (`ecbaed8`) applies the two review findings — a typed failure-classification field and a
  simplified boolean — both behavior-preserving and unit-covered. Disclosed in
  `verification.md`.
- All live evidence is against the seeded fixtures repo; no client repo, issue list, or log
  was touched (confidentiality gate, constraint 3).

## Non-claims

- No claim of triage ranking quality (FR-003 disclaims it).
- The degraded-triage path and file-overlap deferral are unit-proven only — neither fired in
  a live run.
- No claim about run duration/cost or parallelism (future work).
- The harness opened PRs #8/#9; a human merged them. The harness never merges (constraint 1).

## Remaining risks

- Merge-time conflicts between sequential same-module fixes remain possible without
  `--triage` (deterministic default has no file knowledge) — accepted, decision 10 amended.
- One live datapoint each for triage validity and cap-forcing; model output varies run to run.
  The degrade path guarantees a safe deterministic fallback.
- `--issue N` stale-branch retry is unit-proven only (not exercised live this work item).

## Review status

Four-axis review PASSED (`docs/work/WI-2/review.md`): no blocking findings. The three adjacent
findings were resolved the same day at the owner's direction: findings 1 and 2 fixed in
`ecbaed8`, finding 3 (queue-mode exit 0 on mixed outcomes) kept as a recorded deliberate
choice. Verdict re-affirmed for `ecbaed8` in the review follow-up section.

## Branch and base

- Branch: `worktree-wi-2` (worktree `.claude/worktrees/wi-2`), clean tree at delivery time.
- Base: local `main` at `847ba3b`. **Note:** `origin/main` is 2 doc commits behind local main
  (`2dba858`, `847ba3b`); if the PR opens against GitHub's main without pushing main first,
  those 2 commits appear in the PR diff.

## Commit range

`main..worktree-wi-2` = 11 commits, `44f9d10`…`b5b7b25`:

- `44f9d10` T1 acquire · `94b00a2` T2 dedup/stale-branch · `0c40d62` T3 admission/triage ·
  `9356865` T4 queue mode + CLI
- `f7c810f` / `300a7e8` / `cdc6439` T5 live evidence runs (a)/(b)/(c)
- `5d8edbc` verification record · `0b315e5` code review · `ecbaed8` review-finding fixes ·
  `b5b7b25` verification/review refresh for `ecbaed8`

## Requested external actions

None confirmed yet. Prepared options (NOT executed):

1. Push local `main` (`847ba3b`) to `origin/main` so the PR diff shows exactly the 11 WI-2
   commits.
2. Push `worktree-wi-2` and open a PR `worktree-wi-2` → `main` on `manjula25/software-factory-loop`.
3. Optionally comment on / close harness repo Issue #3 (WI-2 tracker mirror) after merge —
   tracker writes need explicit authority per `docs/agents/issue-tracker.md`.

## Executed external actions and observed results

None this step. (Prior authorized external actions during the work item — fixtures PR/branch
cleanup, live-run PRs #8/#9 — are recorded in `verification.md` and the evidence logs.)

## Pending actions

Awaiting owner authorization for any of the prepared options above.
