# WI-13 Verification Record

Candidate: `worktree-wi-13` @ `687e89bc069e49be749815a9aa3052cd58f5e4ae` (base `61b90e2`, 21 commits).
Verified fresh on 2026-09-20. All proving outputs are filed under `evidence/verification/`.

## Exact claim

On branch `worktree-wi-13` at commit `687e89b`:

1. **Harness-source surface:** `npm run typecheck` exits 0; `npm test` passes all tests (258/258, 10 files).
2. **Pipeline-integration surface:** the full WI-13 flow — dependency-aware planner, concurrent wave
   runner, opted-in verified merges with canaries, same-run re-plan — ran green against the seeded
   fixtures repo in local Docker; the evidence is verbatim and its merge commits are verifiable on
   GitHub.
3. **Evidence applicability:** the live run executed from source identical to the candidate's
   source (post-run commits touch only docs).
4. **Docker image:** `npm run smoke:image` passes its 9 checks against the candidate's image.

## Proving commands and results (all fresh, this session)

| # | Claim part | Command | Result | Output |
|---|---|---|---|---|
| 1 | Identity | `git rev-parse HEAD` | `687e89bc069e…` (pinned above); `git status --short` empty | — |
| 2 | Source surface | `npm run typecheck` | **exit 0** | `evidence/verification/typecheck.log` |
| 3 | Source surface | `npm test` | **exit 0 — 258 passed (258), 10 files** (baseline at branch start: 223; delta +35: triage/admission tests deleted with their subjects, planner/wave/merger tests added — per-checkpoint deltas in `implementation-notes.md`) | `evidence/verification/npm-test.log` |
| 4 | Image surface | `npm run smoke:image` | **exit 0 — 9/9 `ok:` checks** | `evidence/verification/smoke-image.log` |
| 5 | Applicability | `git diff --stat 8e6d9a9..687e89b` | 2 files, docs-only (`live-run.log`, `implementation-notes.md`) — the live run's source IS the candidate's source | inline above |
| 6 | External | `gh pr view 33/34/35` on `manjula25/loop-fixtures-py` | **MERGED**, OIDs `b34ef7c753f12ef29ed53468f8656fda8f68283a`, `c773dc423887354e52a88b1e48eb3f895cf1ac06`, `286dc82d6c7b98ccc64dec012f9376a09a950969` — byte-identical to the log's MERGED lines | inline above |
| 7 | External | `gh issue list` (fixtures) | issues 29, 30, 31, 32 all CLOSED | inline above |

Pipeline-integration behavioral evidence: `evidence/live-run.log` (125 lines, verbatim, three
attempts + errata). The green attempt shows, in order: planner plan lines including the seeded
`blocked gh-31 by gh-29` edge → two interleaved lane starts → PRs #33/#34 → serialized
review→merge→canary chains, canaries green → second `[plan]` run surfacing `attempt gh-31` →
PR #35 → merge + green canary → issue closures → summary `attempted: 3 (fixed: 3, failed: 0)`,
exit 0. Focused vitest evidence per checkpoint is recorded in `implementation-notes.md`'s ledger
(focused tags: `plan-parse`, `plan-order`, `planner-wiring`, `admission`, `waves`, `wave-runner`,
`verified-merger`, adapter boundary file).

## Evidence boundaries

- **Harness source:** public-seam vitest with dep-injected mocks; real git/gh/Docker behavior is
  exercised only by the live run.
- **Pipeline integration:** one live run (user-authorized), one fixtures repo
  (`loop-fixtures-py`), local Docker (constraint 6). Sandbox-internal canary logs under
  `.sandcastle/logs/` were not independently read; the recorded log lines are the evidence.
- **Model spend:** attempts 1–2 aborted before fix-agent spend (provider resolution; preflight
  baseline gate). No API ledger was consulted; the abort points in the log are the evidence.
- **Checks outside available authority:** none claimed beyond the above.

## Prior unknowns — reconciliation

| Unknown (origin) | Disposition |
|---|---|
| T6 concurrency criticals (quality review) | **Closed** — fixed in T6b (aee6c78), dual reviews re-run PASS/APPROVED; mutual-exclusion pinned by test (i); live run shows serialized merge chains |
| Re-plan validation rejecting compliant answers (T6 quality) | **Closed** — edgeIds split, tested (j), live re-plan succeeded (second `[plan]` → gh-31) |
| Real git contention under the mutex (T6b/T8 reviews: not exercisable in vitest) | **Closed for the observed scope** — live run's three merges + syncs completed with no lock contention, no spurious uncanaried HALT; deeper contention remains a non-claim (see below) |
| git ≥ 2.38 for `merge-tree --write-tree` (A37, binding for T10) | **Closed** — host git 2.43.0, recorded in the T10 notes |
| Worktree `.env` gap (A47) | **Closed as documented behavior** — attempt 1 recorded; workaround (export main-checkout `.env`) used and documented; workflow.md change deferred to A40's restructure (owner: backlog) |
| Merger gate conflict path live (A46) | **Deferred** — no real conflict arose in the live run; behavioral coverage is T8's vitest pins only. Effect: the merger path's live behavior is unproven. Owner: future live run with deliberately overlapping fixes (backlog) |
| Seed-design collision (T10 attempt 2) | **Closed** — root cause owner-side; the harness's baseline gate behaved correctly (abort, loud, no spend); correction documented publicly (issue #30 comment, fixtures `9bb828b`) |
| Adjacent backlog A1–A47 | **Deferred** — none blocking; enumerated in `implementation-notes.md` per checkpoint; candidates for a future test-only/docs slice |

## Remaining risks

1. The merger gate's conflict path (probe → merger run → re-verification) has no live exercise
   (A46) — its only behavioral evidence is vitest with mocked deps.
2. Concurrency guarantees are pinned at the dep-call seam (test (i)'s depth probe) and by one
   3-issue live run; heavier parallelism (many lanes, real index contention) is unproven.
3. Docs restructure debt (A40/A41): workflow.md's loop row and CLAUDE.md's `src/loop.ts` row are
   accurate but unreadably long — no correctness risk.

## Non-claims

- The merger pass was NOT exercised against a real conflict in the live run (no conflict arose).
- The live run exercised ONE fixtures repo, ONE provider (`claude-via-proxy`), and 3 issues; no
  claim about other repos, providers, or scale.
- Non-opted-in (`autoMerge` absent) queue behavior is proven by vitest only — the live run used an
  opted-in profile; no live non-opted run was performed.
- No claim about CI, lint (none exists), or cloud sandboxes (constraint 6: local Docker only).
- Review-verdict parsing and attachment surfaces are covered by their pre-WI-13 tests; WI-13 made
  no change there and adds no new claim.
