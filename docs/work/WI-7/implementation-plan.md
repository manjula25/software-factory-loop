# WI-7 Implementation Plan

Branch `worktree-wi-7` (worktree `.claude/worktrees/wi-7`), base `main` @
`391d2de`. Baseline recorded 2026-09-19: clean tree, `npm run typecheck`
exit 0, `npm test` 10 files / 195 tests exit 0. Traced to
`docs/work/WI-7/specification.md` (FR-001…FR-005) and `tickets/1..5`.

Commands (authoritative list, `docs/agents/workflow.md`): harness source is
proven with `npm run typecheck` and `npm test` (vitest; focused runs via
`npm test -- <file>`). No lint exists. Every task follows the implement loop:
dispatch one leaf, controller re-runs everything fresh, sequential
spec-then-quality reviews, controller commits with the exact message below.

---

## Task 1 — acquisition-time remote refresh (FR-001, ticket 1)

Files: `src/queue.ts`, `src/queue.test.ts`, `src/loop.ts` (main() wiring only).

1. **Seam:** add a required `refreshRemoteRefs(repoDir: string): Promise<void>`
   to `QueueDeps` (`src/queue.ts`). `splitQueue` awaits it FIRST, inside the
   existing acquisition try, before `listMergedPrs`. Update the
   `QueueAcquisitionError` message to name the refresh
   (`acquiring queue state failed (refreshing remote refs / listing PRs / fix branches): …`)
   and any test pinning the old message in the same commit.
2. **RED (unit, `src/queue.test.ts`):** existing dep factories gain a default
   no-op `refreshRemoteRefs`. New test: `refreshRemoteRefs` is awaited exactly
   once per `splitQueue` call regardless of issue count (spy counter; 3 issues
   → 1 call). Fails pre-change (dep undefined → construction/type failure is
   not accepted as RED; assert the call-count observation against a tree
   without the `splitQueue` call).
3. **RED (real-git, `src/queue.test.ts`, mirroring the
   `syncMainToOrigin` real-git describe at `src/loop.test.ts:858`):** throwaway
   origin + clone via `mkdtemp`; a merged-then-reverted scenario built with
   plain git (origin/main gains a `Revert "… (#1)"` subject commit AFTER the
   clone); `listMergedPrs` returns a covering merged PR stub; `mainRevertsPr`
   uses the production logic (subjects of `git log --format=%s origin/main`);
   `refreshRemoteRefs` = real `git fetch --prune origin`. Expected failing
   observation pre-fix: with the refresh not yet called by `splitQueue`, the
   stale clone says not-reverted → issue lands `skippedMerged`; the test
   asserts `eligible` contains it. Second test: a throwing
   `refreshRemoteRefs` → `QueueAcquisitionError` from `splitQueue` with the
   refresh named in the message. (Ponytail, 2026-09-19: a planned third test
   — remote branch listing freshened by the fetch — was deleted from this
   plan as vacuous: the production listing uses `git ls-remote`
   (`src/loop.ts:1556`), a live remote query that never reads tracking refs.)
4. **GREEN:** wire the await in `splitQueue`; real wiring in `main()`
   (`src/loop.ts` queueDeps): `execFileSync("git", ["fetch", "--prune",
   "origin"], { cwd: dir, stdio: "inherit" })` — the override path needs no
   extra code (`runOverrideIssue` calls `splitQueue`).
5. **Focused verification:** `npm test -- src/queue.test.ts` exit 0;
   `npm run typecheck` exit 0; full `npm test` green.
6. **Refactor-while-green:** none (ticket 5 owns consolidations).
7. **Commit:** `feat(WI-7): acquisition-time remote refresh — fetch/prune before dedup (FR-001)`

## Task 2 — uncanaried-merge failure surface (FR-002, ticket 2)

Files: `src/loop.ts`, `src/loop.test.ts`.

1. **Outcome shape:** new `LoopOutcome.uncanaried?: { id; prUrl; mergeCommit;
   syncFailure: string; commentNote: string }` (mirrors `RevertedRecord`
   posture: deliberately NO `prUrl` on the outcome itself — the issue is not
   fixed-and-merged, it is merged-but-unverified). New
   `QueueSummary.uncanariedMerges: [string, string][]`; `runQueue` collects
   the record before the harness-abort throw (same pattern as `reverted`);
   `formatSummary` gains its own loud line:
   `⚠️ UNCANARIED MERGE <id>: pr <url> merge <sha> — main sync failed: <reason>; comment: <note>`.
2. **RED (`src/loop.test.ts`, auto-merge describe):** opted-in profile, PR
   opened, review approve, `mergePr` succeeds, `syncMain` dep throws
   `new Error("divergent main")`. Expected failing observation: current tree
   propagates the throw raw (test asserts the returned outcome instead).
   Assert: outcome has `failureKind: "harness"` + `uncanaried` record;
   `commentOnPr` was called once with a body naming the mergeCommit and the
   sync failure; `revertMerge` NOT called; `createFixSandbox` not called again
   (no canary); queue-mode test: `runQueue` rejects with `QueueAbortedError`
   whose summary carries the `⚠️ UNCANARIED MERGE` line (exact-pin the line);
   a throwing `commentOnPr` is recorded in `commentNote` and the abort still
   happens.
3. **GREEN:** wrap the `await deps.syncMain(input.repoDir)` call
   (`src/loop.ts`, start of the canary block) in try/catch; on throw build the
   comment body (`⚠️ UNCANARIED: this merge (<sha>) was NOT canaried — syncing
   the local clone to the merged base failed: <reason>. …human decision…`),
   `assertNoSecrets([body], deps.env)` before the best-effort
   `deps.commentOnPr`, and return the uncanaried outcome (guarded via the
   existing summary/emit path; the `--issue` override surfaces it through the
   existing guarded `Loop finished without a PR` line — no new CLI code).
4. **Focused verification:** `npm test -- src/loop.test.ts`; typecheck; full
   suite.
5. **Commit:** `feat(WI-7): uncanaried-merge failure surface — comment, summary line, halt, no blind revert (FR-002)`

## Task 3 — canary teardown failures (FR-003, ticket 3)

Files: `src/loop.ts`, `src/loop.test.ts`.

1. **Behavior:** in the canary block's `finally`, wrap `canary.close()` +
   `deleteBranch` in their own try/catch producing `teardownFailure?: string`.
   Verdict preservation: `canaryGreen`/`canaryEvidence` as already decided are
   never overwritten. Green + teardown failure → merged outcome plus
   `teardownFailure`, surfaced as a suffix on the existing MERGED summary line
   (`MERGED <id>: … (canary: green; teardown: <reason>)` — grow the
   `mergedPrs` tuple; ponytail shrink 2026-09-19: no parallel
   `QueueSummary.teardownFailures` field, though the implementer may fall
   back to that idiom if the tuple growth reads worse); red + teardown
   failure → the revert path runs unchanged with the failure named in the
   `RevertedRecord` (new optional field, never appended to the evidence
   string) and the `⚠️ REVERTED` summary line.
2. **RED:** two tests in the canary describe: (a) green canary +
   `close()`-throwing sandbox → merged outcome (no revert), teardown failure
   recorded, summary line present (exact-pin); current tree flips this to red
   or propagates — observe and record which. (b) red canary + throwing
   `deleteBranch` → `revertMerge` still called, failure named in the record.
3. **GREEN:** the wrapper per step 1. Existing green/red canary tests must
   stay byte-unchanged.
4. **Focused verification:** `npm test -- src/loop.test.ts`; typecheck; full
   suite.
5. **Commit:** `fix(WI-7): canary teardown failures recorded, never decide/erase the verdict (FR-003)`

## Task 4 — negative-path test pins (FR-004, ticket 4)

Files: `src/loop.test.ts` only.

1. **Pin 1 (secret-bearing diff):** review-pass test: guard env carries a
   secret value (`readEnvFile` fixture as sibling tests use); `fixDiff` returns
   a diff containing it; assert `runReview` is NEVER called and the outcome is
   the review-skip shape with the PR open. **RED evidence = mutation check**
   (the wiring exists): temporarily remove the `assertNoSecrets` call before
   `runReview`, observe this test fail, restore, record the mutation in
   implementation notes.
2. **Pin 2 (throw-path branch deletion):** `runReview` throws; assert
   `deleteBranch` was called with `REVIEW_BRANCH`. Mutation check: remove the
   `finally` deletion, observe failure, restore, record.
3. **Pin 3 (fetch-ref divergence, real git):** extend the
   `syncMainToOrigin` real-git describe (`src/loop.test.ts:858`): current
   branch ≠ main, local main diverged from origin/main →
   `syncMainToOrigin` throws. Boundary-pin (stdlib git behavior — RED is not
   constructible without mutating git itself); document as such.
4. **Focused verification:** `npm test -- src/loop.test.ts`; typecheck; full
   suite (expect +3 tests).
5. **Commit:** `test(WI-7): pin guard wiring — secret-diff blocks review, throw-path deletion, divergent-base refusal (FR-004)`

## Task 5 — refactor-while-green, seam-frozen (FR-005, ticket 5)

Files: `src/loop.ts`, `src/queue.ts`, `src/onboard-profile.ts`,
`src/loop.test.ts`, `src/queue.test.ts` (helper extraction only).

1. Extractions/consolidations, each verified byte-green before the next:
   - `runPreMergeReview()` and `runCanary()` helpers extracted from
     `runSingleIssue`'s merge-chain tail (`src/loop.ts`);
   - `advanceUpstream()` test helper for the repeated real-git
     upstream-advance preamble (`src/loop.test.ts`, 4 occurrences);
   - `BoundedRunOptions` named type replacing the third inline copy of the
     bounded-run options shape (`src/sandcastle-adapter.ts` exports only —
     boundary file byte-unchanged);
   - `covers` predicate for the duplicated merged-PR match expression
     (`src/queue.ts` `splitQueue`, and the open-PR check if shape-identical);
   - `valuelessFlag` helper at n=3 (`src/onboard-profile.ts`);
   - rename `OPEN_PR_PAGE_LIMIT` → `PR_PAGE_LIMIT` (`src/queue.ts`, export +
     test references);
   - dedupe the byte-identical `CANARY_RED_*` fixtures into one constant
     (`src/loop.test.ts`);
   - `autoMerge` doc-comment wording: "Hand-editable in profile.json" →
     "hand-editable only by a human, outside the harness" (`src/loop.ts`).
2. **Gate:** same test count, ZERO assertion edits (test-factory/helper-scope
   edits allowed only where they are pure moves); any other test edit stops
   the task and routes back through review. Public seam signatures unchanged
   (review-input `diff` field and positional `closeIssue` frozen).
   `git diff` on `src/sandcastle-adapter.boundary.test.ts` must be empty.
3. **Verification:** `npm run typecheck` exit 0; full `npm test` — same file
   and test counts as task 4's final tree.
4. **Commit:** `refactor(WI-7): refactor-while-green batch — extractions, consolidations, rename (FR-005)`

---

## Rollback-safe sequencing

Tasks 1 and 2 are independent (different seams) and may land in either order;
3 and 4 depend on 2; 5 depends on all. Each task is one commit, revertable
independently; no task migrates data or leaves half-states — the only
cross-task constraint is the ordering above.

## Completion gate (per task, controller-run)

Fresh at the exact candidate: focused file suite, `npm run typecheck`, full
`npm test`; sequential read-only spec-then-quality reviews before the commit;
notes + verification appended per checkpoint. Pipeline-integration surface:
no new integration claim this work item (no behavior the fixtures run would
newly exercise beyond FR-002/FR-003's unit-proven paths; recorded as a
non-claim in verification).
