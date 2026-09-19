# WI-7 Verification Record

Controller-run evidence, appended per checkpoint. Harness-source surface unless a
check says otherwise; commands from `docs/agents/workflow.md`.

## T1 — acquisition-time remote refresh (FR-001)

Claim: `splitQueue` refreshes the target clone's remote-tracking refs
(`git fetch --prune origin`, via the required `QueueDeps.refreshRemoteRefs`
member) before reading any dedup signal, so a revert that landed on origin after
the clone restores its issue to todo instead of skipping it as merged; a failing
refresh aborts acquisition as `QueueAcquisitionError` naming the refresh.

Exact candidate: `7d84b10` (base `a91e8a5`), branch `worktree-wi-7`.

| Check | Command | Result |
|---|---|---|
| Focused suite | `npm test -- src/queue.test.ts` | 1 file / 34 tests passed, exit 0 |
| Typecheck | `npm run typecheck` (tsc --noEmit) | exit 0 |
| Full suite | `npm test` | 10 files / 198 tests passed, exit 0 |

RED evidence (leaf-observed, pre-fix, same three tests): spy count
`expected +0 to be 1`; throwing refresh not surfaced as `QueueAcquisitionError`;
real-git stale clone `expected [ 'gh-1' ] to deeply equal []` on `skippedMerged`.
Verbatim lines in implementation-notes.md.

Evidence boundary:
- Unit seam (`src/queue.test.ts`) + real-git throwaway origin/clone (mkdtemp,
  plain git, production revert-guard logic) + tsc. No source-text assertions.
- Non-claim: the `main()` CLI wiring (`execFileSync("git", ["fetch", "--prune",
  "origin"])` in queueDeps) is typechecked, not executed end-to-end against a
  live GitHub remote; no gh/network pipeline run in this work item claims it.
- Non-claim: no pipeline-integration (Docker/fixtures) claim for FR-001 — the
  refresh is unit- and real-git-proven at the `splitQueue` seam only.

Reviews: specification PASS, code-quality APPROVED, both at the fixed package
`a91e8a5` → `7d84b10` (record in implementation-notes.md).

## T2 — uncanaried-merge failure surface (FR-002)

Claim: when the post-merge main sync fails after a successful opt-in
squash-merge, the run (1) posts a best-effort warning comment on the merged PR
naming the merge commit and the sync failure (through `assertNoSecrets`), (2)
records the event as `LoopOutcome.uncanaried` (no `prUrl` on the outcome) and
a `⚠️ UNCANARIED MERGE` summary line via `QueueSummary.uncanariedMerges`
(exact-pinned), (3) halts the queue as a harness-level failure with non-zero
exit on the `--issue` override path, and (4) never reverts the merge and never
runs a canary on this path.

Exact candidate: `27abf15` (base `be5f210`), branch `worktree-wi-7`.

| Check | Command | Result |
|---|---|---|
| Focused suite | `npm test -- src/loop.test.ts` | 1 file / 94 tests passed (90+4), exit 0 |
| Typecheck | `npm run typecheck` (tsc --noEmit) | exit 0 |
| Full suite | `npm test` | 10 files / 202 tests passed (198+4), exit 0 |

RED evidence (leaf-observed, pre-fix): raw `Error: divergent main` propagated
out of `runSingleIssue`/`runOverrideIssue`; queue tests saw the raw error
instead of `QueueAbortedError`. Verbatim lines in implementation-notes.md.

Evidence boundary:
- Vitest public-seam suite + tsc only. The sync failure is exercised via the
  LoopDeps seam (throwing `syncMain` mock), consistent with how the sibling
  revert/canary paths are tested.
- Non-claim: no Docker/pipeline-integration run of the uncanaried path against
  a real repo; no canary verdict is claimed for the uncanaried merge (by
  definition none ran); no automatic sync retry exists (left for a human).
- Hard constraint 1 unchanged: auto-merge gating untouched; this failure
  surface only governs what happens AFTER an already-authorized opt-in merge.

Reviews: specification PASS, code-quality APPROVED, both at the fixed package
`be5f210` → `27abf15` (record in implementation-notes.md).

## T3 — canary teardown failures never decide or erase the verdict (FR-003)

Claim: a teardown failure in the canary block (`canary.close()` throwing, or
the canary branch delete refusing) is recorded beside the verdict and never
changes it — a green canary stays merged with the failure named on the MERGED
summary line (`(canary: green; teardown: <reason>)`, via the `mergedPrs` tuple
growth), a red canary still reverts with the failure in
`RevertedRecord.teardownFailure` (never in `evidence`) and on the `⚠️ REVERTED`
line; no unhandled rejection on either path; existing canary tests
byte-unchanged.

Exact candidate: `23f0a35` (base `0dcf132`), branch `worktree-wi-7`.

| Check | Command | Result |
|---|---|---|
| Focused suite | `npm test -- src/loop.test.ts` | 1 file / 96 tests passed (94+2), exit 0 |
| Typecheck | `npm run typecheck` (tsc --noEmit) | exit 0 |
| Full suite | `npm test` | 10 files / 204 tests passed (202+2), exit 0 |

RED evidence (leaf-observed, pre-fix; failure mode recorded per plan): green
path SILENTLY SWALLOWED the close()-throw (outer catch overwrote
`canaryEvidence`, which the green path discards — merged outcome carried no
note); red path OVERWROTE the already-decided evidence
(`expected 'canary sandbox failed to run: git: branch -D refused…' to contain
'tests/test_contract.py::test_zero_contract'`). Independently confirmed
against base by the spec reviewer. Verbatim lines in implementation-notes.md.

Evidence boundary:
- Vitest unit seam + tsc only; no live Docker/gh run of a teardown failure.
- Non-claim: teardown is not retried; leftover throwaway branches from a
  failed teardown are tolerated (the next run's stale-branch pass cleans
  them) — not proven here.
- Non-claim: the single-issue `--issue` override path prints no
  `teardownFailure` line (queue summary + record carry it; per plan scope).
- Confidentiality: teardown strings reach the terminal only via
  `formatSummary`'s guarded emit — no new unguarded emission.

Reviews: specification PASS, code-quality APPROVED, both at the fixed package
`0dcf132` → `23f0a35` (record in implementation-notes.md).

## T4 — negative-path test pins (FR-004)

Claim: three already-wired guard behaviors gain failing-first pins —
(1) a fix diff carrying a configured secret value never reaches the
pre-merge review call (review skipped, PR stays open, surfaces name the key
never the value); (2) the throwaway `loop/review` branch is deleted when the
review run throws; (3) the sync path for a non-checked-out base refuses a
divergent base (real git, throwaway repos).

Exact candidate: `2bbca7d` (base `436f47b`), branch `worktree-wi-7`.
Test-only: `git diff 436f47b..2bbca7d -- src/loop.ts` is empty.

| Check | Command | Result |
|---|---|---|
| Focused suite | `npm test -- src/loop.test.ts` | 1 file / 99 tests passed (96+3), exit 0 |
| Typecheck | `npm run typecheck` (tsc --noEmit) | exit 0 |
| Full suite | `npm test` | 10 files / 207 tests passed (204+3), exit 0 |

RED justification: pins 1–2 pass on the unmutated tree BY DESIGN; their RED
evidence is the recorded mutation checks — mutation 1 (guard removed before
`runReview`): `runReview` called once, pin failed; mutation 2 (`finally`
deletion emptied): `deleteBranch` fired only for the preflight branch, never
`loop/review`, pin failed; both restored via `git checkout` (byte-clean
production proven by the committed diff) and re-run green. Pin 3 is a
documented BOUNDARY-PIN (stock git refusal of a non-fast-forward ref update;
no natural RED without mutating our own wiring into a forced refspec).
Verbatim outputs in implementation-notes.md.

Evidence boundary:
- Pins existing wiring only; adds no new guard rules. Secret is a synthetic
  in-test fixture; no `.env` value was read, printed, or echoed.
- Non-claim: mutation-check executions leave no repository trace by design;
  their record lives in implementation-notes.md (closes the spec reviewer's
  evidence-of-execution question).
- Pin 3 exercises real git in a throwaway clone, not the Docker sandbox path.

Reviews: specification PASS, code-quality APPROVED, both at the fixed package
`436f47b` → `2bbca7d` (record in implementation-notes.md).

## T5 — refactor-while-green, seam-frozen (FR-005)

Claim: the seven applied quality consolidations (merge-chain helper
extraction, `advanceUpstream` test helper ×5, `BoundedRunOptions` named type,
`covers` predicate ×2, `PR_PAGE_LIMIT` rename, `CANARY_RED_SUITE` fixture
dedupe, `autoMerge` doc wording) change ZERO behavior — same file count, same
test count, zero assertion edits, public seams unchanged, boundary test file
byte-unchanged. The eighth item (`valuelessFlag`) was stopped, not forced:
only 2 occurrences exist, the plan's n=3 premise doesn't hold.

Exact candidate: `3a12444` (base `2643031`), branch `worktree-wi-7`.

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` (tsc --noEmit) | exit 0 |
| Full suite | `npm test` | 10 files / 207 tests passed — identical to base, exit 0 |
| Boundary freeze | `git diff 2643031..3a12444 -- src/sandcastle-adapter.boundary.test.ts` | empty (0 lines) |
| Assertion freeze | diff review (controller + both reviewers) | zero assertion edits; only the sanctioned `PR_PAGE_LIMIT` rename pair; all other test changes pure moves |
| Seam freeze | diff review | review-input `diff` field and positional `closeIssue` byte-identical; helpers module-private |

Evidence boundary:
- Quality-only: non-behavior-change proven by the byte-green criterion, NOT
  by new behavioral evidence. Does not hunt bugs (code-review's job).
- Non-claim: no Docker/pipeline-integration run of this tree in this task;
  the unit suite's 207 passing tests at unchanged counts are the evidence.
- Premise corrections recorded: 5 not 4 `advanceUpstream` occurrences; 2 not
  3 `BoundedRunOptions` copies; `valuelessFlag` n=3 unmet → stopped per the
  plan's own rule (forcing an n=2 abstraction would be unsanctioned).

Reviews: specification PASS (normalized hunk-by-hunk verbatim-move proof of
the extraction, WI-7 uncanaried + FR-003 teardown paths confirmed moved
intact), code-quality APPROVED — both at the fixed package `2643031` →
`3a12444` (record in implementation-notes.md).

## Work-item completion verification (all tasks, final candidate)

Claim: WI-7's five approved tasks (FR-001…FR-005) are implemented on branch
`worktree-wi-7`; the harness-source suite is green; no behavior is claimed
beyond the unit/real-git seam evidence recorded per task above.

Exact candidate: `f868771` (17 commits ahead of `main` @ `391d2de`: planning
chain, 5 task commits, 5 evidence commits, header normalization). Tree clean.

| Check | Command | Result (fresh, 2026-09-19) |
|---|---|---|
| Typecheck (all surfaces, harness source) | `npm run typecheck` | exit 0 |
| Full suite | `npm test` | Test Files 10 passed (10), Tests 207 passed (207), exit 0 |
| Boundary freeze (carried from T5, still the committed tree) | `git diff 2643031..3a12444 -- src/sandcastle-adapter.boundary.test.ts` | empty — and the boundary test file is among the 10 passing |

The T5 refactor moved the code the T1–T4 tests pin; the final-tree run of the
identical 207 tests (zero assertion edits) revalidates every per-task
behavioral claim above at the final candidate. Stderr git noise in the run
output is the real-git tests' expected output (incl. the deliberate
non-fast-forward rejections the FR-004 boundary pin asserts).

### Unknown reconciliation

Closed with evidence:
- T1 RED question (does a stale clone really skip a reverted issue as
  merged?) — closed by the real-git test at RED and GREEN.
- T3 failure-mode question (flip vs propagate on teardown throw) — closed:
  base silently swallowed (green) / overwrote evidence (red); both pinned.
- T4 evidence-of-execution for the mutation checks — closed by the recorded
  verbatim outputs in implementation-notes.md (mutations leave no repo trace
  by design).
- T5 premise counts (4/3/3) — closed by grep: actual 5/2/2; `valuelessFlag`
  stopped as the plan's own rule requires.

Deferred (follow-up backlog, owner: future work item; none material to this
work item's claims):
- `main()` CLI refresh wiring and the uncanaried path are typechecked but not
  executed end-to-end against a live GitHub remote (pipeline-integration
  non-claim, below).
- Preflight/verification sandboxes' teardown still propagates (same failure
  class as FR-003, out of scope).
- `--issue` override path prints no teardownFailure line; uncanaried path has
  no @-notification (both plan-sanctioned omissions needing their own FRs).
- Test-knob naming/doc nits and the T2/T5 consolidation candidates recorded
  in implementation-notes.md.
- Carried WI-6 deferred items (revert-matcher permanence after human
  re-merge; skipped-merged summary cosmetic) — untouched by WI-7, still open.

Remaining risks: none beyond the deferred list — every claim above maps to a
fresh green run or a recorded verbatim observation at an exact candidate.

### Work-item non-claims

- Pipeline integration: no Docker/fixtures/gh run of the WI-7 tree — the
  plan's completion gate records this as a deliberate non-claim (FR-002/FR-003
  are unit-proven at the loop seam; no new integration surface was claimed).
- The `main()` queueDeps `git fetch --prune origin` wiring is typechecked,
  not executed against a live remote.
- FR-005 proves non-behavior-change by the byte-green criterion only.
- Hard constraint 1 is unchanged throughout: auto-merge gating untouched;
  this repo still never auto-merges itself.
