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
