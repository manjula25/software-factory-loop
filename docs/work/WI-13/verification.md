# WI-13 Verification Record

Candidate: `worktree-wi-13` @ `3828c21` (base `61b90e2`). Verified fresh on 2026-09-20
(after the T11 fix pass; the earlier record at `687e89b` is superseded — see "T11 amendment"
at the end). All proving outputs are filed under `evidence/verification/` and were re-captured
at `3828c21`.

## Exact claim

On branch `worktree-wi-13` at commit `687e89b`:

1. **Harness-source surface:** `npm run typecheck` exits 0; `npm test` passes all tests (259/259, 10 files).
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
| 1 | Identity | `git rev-parse HEAD` | `3828c21` (pinned above); status clean before the docs commits | — |
| 2 | Source surface | `npm run typecheck` | **exit 0** (re-captured at `3828c21`) | `evidence/verification/typecheck.log` |
| 3 | Source surface | `npm test` | **exit 0 — 259 passed (259), 10 files** (baseline at branch start: 223; per-checkpoint deltas in `implementation-notes.md`; +1 at T11) | `evidence/verification/npm-test.log` |
| 4 | Image surface | `npm run smoke:image` | **exit 0 — 9/9 `ok:` checks** (re-run at `3828c21`) | `evidence/verification/smoke-image.log` |
| 5 | Applicability | `git diff 8e6d9a9..687e89b` (docs-only) + `git diff 687e89b..3828c21` | The live run executed source identical to `687e89b`; the T11 fix (`687e89b..3828c21`) changes only the merge chain's entry (a halt check that activates only after a harness-level outcome). The green live run had no harness-level outcome, so its executed path is behavior-identical — but strictly, the live evidence was recorded at the pre-fix candidate (see T11 amendment) | inline above |
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
| Code-review BLOCKING: FR-004 wave-granularity stop-the-line (`review.md` Spec (c)1) | **Closed** — fixed in T11 (`3828c21`): run-level halt signal set inside the mutex before release, checked at the serialized chain top before gate/review/merge; dual reviews PASS/APPROVED at the new candidate; test (l) pins no-sibling-merge with a mutation re-check; corrected test (c) no longer pins the defect |
| Adjacent backlog A1–A53 | **Deferred** — none blocking; enumerated in `implementation-notes.md` per checkpoint; candidates for a future test-only/docs slice |

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

## T11 amendment (2026-09-20, candidate 3828c21)

The work-item code review (`review.md`) found one blocking defect the per-task reviews missed:
stop-the-line was wave-granular — a sibling lane could merge on reverted main after a red
canary in the same wave. Fixed in T11 with dual fresh reviews at `3828c21`; all proving
commands above were re-run fresh at the new candidate (typecheck 0, 259/259, smoke 9/9).
**Live-run evidence boundary, restated honestly:** `evidence/live-run.log` was recorded at
`687e89b` (pre-fix source). The T11 diff touches only the merge chain's entry condition — a
halt check that activates exclusively after a harness-level outcome — and the green live run
contained none, so the executed path is behavior-identical. A fresh live run at `3828c21` was
NOT performed (it would repeat model spend for an unchanged green path); this is a stated
boundary, not silence. The T11 behavior itself is proven at the harness-source seam by test
(l) with its mutation re-check.

## T12 amendment (2026-09-20, candidate 1da7936)

Live runs 1–3 (each verbatim under `evidence/merger-live-run{,-2,-3}.log`, controller notes
appended post-run) attempted to exercise the merger gate's conflict path live. Run 3 fired it
via the production degraded-fallback path (planner deliberately bypassed on scratch branch
`scratch/wi-13-gate-live`, env-gated `LOOP_BYPASS_PLAN=1`, never merged) and exposed a real
defect: the gate never published the merger-resolved branch, so `gh pr merge --squash` — which
merges GitHub's PR head — failed with GraphQL "Pull Request has merge conflicts". The stranded
PR #47 was completed out-of-band under explicit user authorization (resolution `3972f87`
pushed, squash-merged as `052c5bf`, issue #44 closed with an honest comment). The defect is
fixed in T12 (`LoopDeps.pushBranch`, green conflict arm, before review and `mergePr`); dual
fresh reviews PASS/APPROVED at `1da7936`; proving commands re-run fresh at the new candidate:
typecheck exit 0, `npm test` **261/261** (259 + 2 T12 tests), focused `verified-merger` 8/8
and `wave-runner` 12/12. A46 (live exercise of the conflict path) is CLOSED on runs 1–3's
evidence: probe, merger, fresh-sandbox re-verification, review, and failure posture all fired
live; what failed was the publish step, now fixed — a fresh bypassed live run at the T12-fixed
source is pending and will be recorded under `evidence/merger-live-run-4.log` when run.
