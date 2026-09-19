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
