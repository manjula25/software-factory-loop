# WI-6 Implementation Plan — auto-merge

*Revised 2026-09-18 after `/ponytail` — three accepted recommendations folded
in (R1: `--notify` flag deleted, hand-edit only; R2: shared
`boundedRunOptions` factory; R3: shared `prListArgs(state)` factory).*

Inputs of record: `docs/work/WI-6/specification.md` (approved 2026-09-18),
`docs/work/WI-6/slices.md`, tickets `docs/work/WI-6/tickets/t1…t7`. Baseline recorded
fresh at `749b132` (worktree `.claude/worktrees/wi-6`, branch `worktree-wi-6`):
`npm run typecheck` exit 0; `npm test` = 10 files / 145 tests passed.

Repository facts this plan is built on (verified 2026-09-18):
tests are colocated in `src/*.test.ts`; the loop's dependency-injection seam is
`LoopDeps` (`src/loop.ts:75`) with `createPr` at `src/loop.ts:108` as the pattern for
new deps; queue dedup lives in `splitQueue` (`src/queue.ts:138`) over
`openPrListArgs()` (`src/queue.ts:53`); the profile is shaped by `onboardProfile`
(`src/onboard-profile.ts:44`, valueless-flag pattern at :51); `buildPrBody` ends with
the human-review sentence at `src/loop.ts:277`; the gh-sourced `sourceType` literal is
`"github-issue"` (`src/issues.ts:41`); a bounded one-shot model call has an existing
pattern in `runTriage`/`triageRunOptions` (`src/sandcastle-adapter.ts:165-198`);
provider defaults are already cheap models (`src/providers.ts:15-16`) — the review
pass reuses the run's own `AgentSpec`, no new provider. Fixtures repo for T7:
`/home/bitcot/Documents/projects/loop-fixtures-py` (GitHub-hosted, real `gh` target),
image `sandcastle-loop`.

## Plan-level design decisions (fixed here; leaves do not re-decide)

1. **D1 — merge seam.** New `LoopDeps.mergePr(input: { repoDir; prUrl })` returning
   `{ mergeCommit }`. Real wiring: `gh pr merge <url> --squash --delete-branch`, then
   `gh pr view <url> --json mergeCommit -q .mergeCommit.oid`. Squash keeps main linear
   (decision 2, WI-5); `--delete-branch` cleans the fix branch remote+local — the
   merged PR itself stays queryable in merged state for FR-002.
2. **D2 — canary green definition.** On merged main, parse the full-suite output with
   the existing `parseSuiteOrReject`; **red** iff output is unreadable, install fails,
   or any parsed failure is not in `profile.baselineFailures` (the same new-failure
   rule as `diffVerification`). A regression of a previously-passing test and a
   still-failing new repro test are both red; unfixed born-red baseline failures are
   not.
3. **D3 — canary placement.** The auto-merge chain (review → merge → canary → close)
   runs in `runSingleIssue` **after** the verification sandbox's `finally` closes it —
   merging deletes the branch that sandbox sits on. The chain needs a fresh sandbox on
   updated main: new dep `syncMain(repoDir)` (`git fetch origin main:main`, loud on
   divergence), then `createFixSandbox({ branch: "loop/canary-<issue.id>",
   baseBranch: "main" })`, install + `testCmd`, close, `deleteBranch`.
4. **D4 — revert and the dedup interplay.** New dep `revertMerge(repoDir,
   mergeCommit)`: on main, `git revert --no-edit <mergeCommit>` then
   `git push origin main`. `git revert` of a squash commit produces subject
   `Revert "<original subject>"`, and gh's squash subject embeds `(#<pr number>)` — so
   a new dep `mainRevertsPr(repoDir, prNumber): Promise<boolean>` (grep
   `git log --format=%s origin/main` for a line that is a `Revert "` of that `(#N)`)
   lets `splitQueue`'s merged-dedup (T2) skip **only** merged PRs not reverted on
   main. That is the FR-006 mechanism for "reverted issue stays queued".
5. **D5 — halt mechanism.** No new abort channel: a reverted outcome carries
   `failureKind: "harness"` (existing semantics: `runQueue` throws
   `QueueAbortedError`, CLI prints summary + reason, exit 1 — `src/loop.ts:639-641`,
   `:905-938`). The summary gains `mergedPrs: [id, url, mergeCommit][]` and
   `reverted: { id; prUrl; mergeCommit; revertCommit; canaryEvidence }[]`;
   `formatSummary` prints the `⚠️ REVERTED` section.
6. **D6 — notify identity.** The profile carries an optional
   `notifyHandle?: string` — **hand-edit only** (R1, ponytail 2026-09-18): a
   once-per-repo value does not earn a CLI surface, and the profile is already the
   endorsed hand-edit mechanism (FR-001's own "hand-editable" rule). No onboarding
   flag, no writer code — `ProjectProfile` gains the field; the human edits
   `profile.json`. Absent → the revert comment is still posted, without a mention,
   and the summary says `notify handle not configured`. This discharges FR-007's
   "configured identity". Not in `.env`: guard semantics forbid echoing env values,
   and a handle must appear in the comment body.
7. **D7 — review pass mechanics.** New adapter export `runReview(input)` cloned from
   `runTriage`: one `run({...})` with `maxIterations: 1` on throwaway branch
   `loop/review` (new const `REVIEW_BRANCH`). The cost-control options object is a
   **shared factory** (R2): `boundedRunOptions(name: string, branch: string)` with
   `maxIterations: 1`, replacing `triageRunOptions` — `runTriage` and `runReview`
   both call it, so the budget bound is asserted in one place. Prompt = issue
   description + `git diff main...<fixBranch>`
   (new dep `fixDiff(repoDir, branch)` = `git diff main...<branch>`), required output
   `<review>approve|wrong|uncertain</review>`. New parser `parseReviewOutput(stdout)`
   in `src/queue.ts` beside `parseTriageOutput`: any missing block, unparseable
   content, or thrown run maps to the **uncertain** class. Non-approve → no merge
   call, skip-reason comment via `commentOnPr`, run continues.
8. **D8 — merged-PR listing.** New `QueueDeps.listMergedPrs(repoDir)`. The
   listing args are a **shared factory** (R3): generalize
   `openPrListArgs()` (`src/queue.ts:53`) into
   `prListArgs(state: "open" | "merged")` — the open call sites and tests move to
   `prListArgs("open")` in the same green commit; the merged variant adds
   `number,url` to the json fields. Merged PRs extend `OpenPr` with `number`/`url`
   (a new `MergedPr` interface). `SplitResult` gains `skippedMerged: string[]`,
   surfaced as a summary count.
9. **D9 — PR body mode.** `buildPrBody` gains a final `autoMerge: boolean` param;
   opted-in bodies replace the last line (`src/loop.ts:277`) with the gate-chain
   sentence: merge is automatic after independent verification, a diff-review pass,
   and a post-merge canary suite, with auto-revert on red. Non-opted: byte-identical
   to today.

Every task below: run `npm run typecheck` (expect exit 0) and the named focused
vitest file(s) (`npx vitest run src/<file>.test.ts`, expect the stated counts), then
the full `npm test` before committing. RED = new test written first, observed failing
for the stated reason. Full-suite count grows as tasks land; the controlling number
per checkpoint is recorded in `implementation-notes.md`.

---

## Task 1 — T1: opt-in flag (FR-001, slice 1)

**Files:** `src/onboard-profile.ts`, `src/loop.ts` (ProjectProfile),
`src/onboard-profile.test.ts`, `scripts/onboard.ts` (usage comment), `CLAUDE.md`
(onboard-profile row).

1. **RED.** Add to `src/onboard-profile.test.ts`: (a) `onboardProfile(["--auto-merge"],
   facts)` → `profile.autoMerge === true`; (b) `onboardProfile([], facts)` →
   `!("autoMerge" in profile)`; (c) a hand-written profile JSON without the key is
   what today's writer produces (assertion (b) covers it). Run
   `npx vitest run src/onboard-profile.test.ts` → (a) fails (no such field).
2. **GREEN.** `src/loop.ts`: add `readonly autoMerge?: boolean` to `ProjectProfile`
   with the doc comment: opt-in recorded only by `--auto-merge` at onboarding;
   absent = off; the harness's own repo never sets it (constraint 1, amended).
   `src/onboard-profile.ts`: valueless flag exactly like `cleared`:
   `const autoMerge = argv.includes("--auto-merge");` and
   `...(autoMerge ? { autoMerge: true } : {})`. Focused run → all pass.
3. **Docs.** `scripts/onboard.ts` usage header gains `[--auto-merge]`;
   `CLAUDE.md` onboard-profile row mentions the auto-merge flag (WI-6).
4. **Commit.** `feat(WI-6): --auto-merge onboarding flag → profile autoMerge: true (FR-001)`

## Task 2 — T2: merged-PR dedup (FR-002, slice 2)

**Files:** `src/queue.ts`, `src/loop.ts` (real wiring + summary),
`src/queue.test.ts`, `src/loop.test.ts` (summary line only).

1. **RED.** In `src/queue.test.ts`, drive `splitQueue` with a `listMergedPrs` stub:
   - (b) merged PR (head `fix/gh-2` or body token `gh-2`) → `skippedMerged` contains
     `gh-2`, not in `eligible`, `deleteBranch`/`deleteRemoteBranch` never called;
   - (c) `listFixBranches` returns `fix/gh-2` AND merged PR covers `gh-2` → branch
     **not** deleted, not eligible;
   - (d) branch exists, PR closed-unmerged (absent from both lists) → deleted and
     retried (existing behavior, now pinned);
   - (a) open PR → `skippedDuplicate` (existing, unchanged).
   Run → fails: `listMergedPrs` is not part of `QueueDeps`.
2. **GREEN.** Implement D8: `MergedPr` interface, `prListArgs(state)` (the
   refactor of `openPrListArgs` — its existing call sites in `src/loop.ts` and its
   assertions in `src/queue.test.ts` move to `prListArgs("open")` in this same
   commit, refactor-while-green), `QueueDeps.listMergedPrs`,
   `SplitResult.skippedMerged`. In `splitQueue`, the
   merged check runs **before** the open-PR check and before any branch deletion
   (`revertedOnMain` guard arrives in Task 4 — the dep slot
   `mainRevertsPr` is added there, not now). `runQueue` passes `skippedMerged` into
   `QueueSummary` (new field) and `formatSummary` adds
   `| skipped-merged: N` to the counts line. Real wiring in `main()`:
   `listMergedPrs` via `realGhJson(prListArgs("merged"), dir)`. Note: `runOverrideIssue`
   inherits the dedup automatically (it calls `splitQueue`).
3. **Commit.** `feat(WI-6): merged-PR dedup — merged fix means issue done; merged branch never retried (FR-002)`

## Task 3 — T3: merge machinery + conditional PR body (FR-003, FR-004 wiring, slice 3)

**Files:** `src/loop.ts`, `src/loop.test.ts`, `docs/agents/workflow.md` (loop row).

1. **RED.** In `src/loop.test.ts`, extend the existing `runSingleIssue` stub-deps
   harness with a `mergePr` stub:
   - opted-in + verification green → `mergePr` called once with the created PR url;
     outcome carries `merged: { prUrl, mergeCommit }`;
   - opted-out → `mergePr` never called; outcome identical to today's;
   - `mergePr` stub throws (conflict) → no `merged` on outcome, `mergeFailure`
     string recorded, run does not throw, PR result still returned;
   - `buildPrBody(..., true)` contains `canary` and not the sentence
     `A human reviews and merges this`; `buildPrBody(..., false)` ends with today's
     sentence unchanged.
   Run → fails: no `mergePr` in `LoopDeps`, no `autoMerge` param.
2. **GREEN.** Implement D1 (`LoopDeps.mergePr` + real wiring in `main()`), D9
   (`buildPrBody` final param; caller at the PR-creation site passes
   `input.profile.autoMerge === true`). Restructure per D3: capture `prUrl` from
   `createPr` inside the try block into a `let`, let the `finally` close the
   verification sandbox, then run the merge step after it, gated on
   `input.profile.autoMerge === true`: `try { const merged = await
   deps.mergePr({...}) } catch { mergeFailure }`. The review-pass slot (Task 6)
   sits between `createPr` and `mergePr` — leave a clearly marked gap comment.
   `QueueSummary.mergedPrs` populated in `runQueue`; `formatSummary` prints
   `MERGED <id>: <url> @ <mergeCommit>`.
3. **Docs.** `docs/agents/workflow.md` loop-command row: append that on profiles with
   `autoMerge: true` verified PRs are squash-merged automatically (revert net per
   CLAUDE.md constraint 1).
4. **Commit.** `feat(WI-6): squash-merge machinery behind autoMerge + mode-conditional PR body (FR-003, FR-004)`

## Task 4 — T4: canary, revert, halt, notify (FR-005/006/007, slice 4)

**Files:** `src/loop.ts`, `src/queue.ts`, `src/loop.test.ts`,
`src/queue.test.ts`, `CLAUDE.md`.

*`notifyHandle` is a hand-edit-only profile field (D6, R1) — no onboarding flag,
no writer code; `ProjectProfile` gains the typed field in this task's GREEN step.*

1. **RED (chain).** In `src/loop.test.ts` with stubbed
   `syncMain`/`revertMerge`/`commentOnPr`/`mainRevertsPr` and a canary
   `createFixSandbox` that returns a programmable suite result:
   - merge success → canary sandbox created on `loop/canary-<id>` from synced main,
     install + `testCmd` executed, result recorded in the summary;
   - canary green (failures ⊆ baseline) → outcome `merged`, queue continues to next
     issue;
   - canary red (a failure not in baseline) → `revertMerge` called with exactly the
     merge commit; outcome `failureKind: "harness"` + `reverted` record;
     `runQueue` throws `QueueAbortedError`; CLI exits 1;
   - red → `commentOnPr` called once with a body containing `@<notifyHandle>` and
     `REVERTED` (profile carries `notifyHandle` in the test fixture); green paths →
     never called; red with `notifyHandle` absent → comment still posted, no
     mention, summary says `notify handle not configured` (D6);
   - canary install failure / unreadable suite output → red path (D2);
   - `revertMerge` throws → still halted, still exit 1, revert failure recorded;
   - summary text contains a `⚠️ REVERTED` section naming id, PR, merge commit,
     revert commit, canary evidence.
   In `src/queue.test.ts`: merged PR whose `mainRevertsPr` stub returns true →
   **eligible** (not `skippedMerged`) — the FR-006 re-queue rule.
   Run → all fail (deps/fields absent).
2. **GREEN (chain).** Implement D2–D5: `ProjectProfile.notifyHandle?: string`
   (type only — hand-edit field, no writer), `LoopDeps.syncMain`, `revertMerge`,
   `commentOnPr` (`gh pr comment <url> --body <body>`), `mainRevertsPr`; the
   canary step per D3; halt via `failureKind: "harness"` on the reverted outcome
   (existing `QueueAbortedError` path carries the summary out); `QueueSummary.reverted`
   + `formatSummary` `⚠️ REVERTED` block; `splitQueue` merged-check gains the
   `mainRevertsPr` guard. All strings that reach terminals/comments pass
   `assertNoSecrets` as today.
3. **Docs.** `CLAUDE.md` loop.ts row: merge/canary/revert.
4. **Commit.** `feat(WI-6): post-merge canary with auto-revert, run halt, @-mention notification (FR-005/006/007)`

## Task 5 — T5: issue closing on merge (FR-008, slice 5)

**Files:** `src/loop.ts`, `src/loop.test.ts`.

1. **RED.** Stubbed `closeIssue` dep:
   - merged + canary green + `sourceType === "github-issue"` → `closeIssue` called
     once with the issue url/number and a body naming the PR url + merge commit;
   - merged + green + `sourceType === "spec-doc"` (and `"plain-list"`) → never
     called, no error;
   - reverted (red) → never called even for `github-issue`;
   - `closeIssue` throws → recorded loudly, outcome still `merged`, queue continues.
   Run → fails.
2. **GREEN.** `LoopDeps.closeIssue(repoDir, issue, comment)` (real:
   `gh issue close <n> --comment <body>`; number parsed from the issue url),
   invoked at the end of the green auto-merge chain only (ordering D3: merge →
   canary → close).
3. **Commit.** `feat(WI-6): close gh-sourced issues with evidence after canary-green merges (FR-008)`

## Task 6 — T6: pre-merge review pass (FR-009 + completes FR-004 order, slice 6)

**Files:** `src/sandcastle-adapter.ts`, `src/queue.ts`, `src/loop.ts`,
`src/queue.test.ts`, `src/loop.test.ts`, `src/sandcastle-adapter.boundary.test.ts`
(no change expected — assert it still passes), `CLAUDE.md`.

1. **RED (parser).** `src/queue.test.ts` → `parseReviewOutput`:
   `<review>approve</review>` → `approve`; `wrong`/`uncertain` likewise; missing
   block, `<review>maybe</review>`, empty → `uncertain`. Fails.
2. **GREEN (parser + adapter).** `parseReviewOutput` beside `parseTriageOutput`;
   `REVIEW_BRANCH = "loop/review"`; refactor `triageRunOptions` into the shared
   factory `boundedRunOptions(name, branch)` (R2 — `runTriage` calls
   `boundedRunOptions("triage", TRIAGE_BRANCH)`, keeping its existing exported
   behavior; the `maxIterations: 1` bound is asserted once); `runReview(input:
   TriageRunInput & { diff: string })` per
   D7 — the adapter stays the only Sandcastle import (boundary test unchanged and
   green). Prompt built in `src/loop.ts` (`buildReviewPrompt(issue, diff)`) stating
   the three-verdict contract; `assertNoSecrets([prompt])` before the call;
   `deleteBranch(REVIEW_BRANCH)` in a `finally`, exactly like triage.
3. **RED (wiring).** `src/loop.test.ts` with a stubbed reviewer dep:
   - approve → merge proceeds (mergePr called);
   - each of wrong / uncertain / throw → mergePr **never** called, `commentOnPr`
     posts the skip reason on the PR, run continues, summary records the skip;
   - opted-out repo → reviewer never invoked.
   Fails.
4. **GREEN (wiring).** Fill the Task-3 gap: in the auto-merge chain, between
   `createPr` and `mergePr`, call the review pass (dep `fixDiff` via
   `git diff main...<branch>`); non-approve → skip merge with the comment. FR-004's
   full blocking order now holds: verification → review → merge.
5. **Live exercise (one real model call, cost recorded).** Against the fixtures
   repo with a hand-opened PR: run the review pass once via a tsx one-liner/
   scratch script through the real `runReview`, record prompt size, verdict, wall
   time, and token/cost estimate in `docs/work/WI-6/verification.md`. Delete
   `loop/review` afterwards.
6. **Docs.** `CLAUDE.md` loop.ts row mentions the pre-merge review pass.
7. **Commit.** `feat(WI-6): blocking cheap-model diff review before auto-merge (FR-009, completes FR-004 ordering)`

## Task 7 — T7: pipeline integration (FR-010, slice 7)

**Files:** evidence under `docs/work/WI-6/` (verification.md, `evidence/` logs); no
product code expected to change — defects found route back through
`diagnosing-bugs` as slices 1–6 fixes.

Precondition: `npm run build:image` succeeds; fixtures repo
`/home/bitcot/Documents/loop-fixtures-py` re-seeded to a clean buggy main with a
known open issue (existing re-seed practice; the canary-red scenario below reseeds
again).

1. **Green chain, live.** Onboard fixtures with
   `npx tsx scripts/onboard.ts <fixtures> --auto-merge`, then hand-edit the
   fixtures profile to add `"notifyHandle": "manjula25"` (D6 — the field's only
   write path), then
   `npm run loop -- --repo <fixtures> --provider claude-via-proxy --issue <n>`.
   Observe and record (commands + verbatim output in `evidence/`): PR opened with
   gate-chain body → review verdict → squash merge on main (`gh pr view --json
   state,mergeCommit`) → canary suite green on merged main → issue closed with
   evidence comment (`gh issue view --json state,comments`). No merge touches any
   repo but the fixtures repo.
2. **Canary-red, live, zero LLM.** Reseed fixtures; construct the deterministic
   regression: from main, author commit A adding
   `tests/test_zero_contract.py` asserting current `divide` ZeroDivisionError
   behavior; push A to main. From main~1 (pre-A), author fix branch `fix/gh-<n>`
   fixing the seeded issue by changing that behavior + the repro test; push, open
   the PR by hand. Branch verification content = pre-A tree (green; the new
   contract test is absent there). Then drive the merge path with real
   gh/git/Docker but the agent stubbed (a tsx driver calling `runSingleIssue`'s
   auto-merge chain through `LoopDeps` whose `runFixRun` returns the pre-authored
   branch's evidence) → merge succeeds → canary on merged main fails the contract
   test → revert lands on main (`git log` shows `Revert "… (#<n>)"`), run halts,
   exit 1, `@manjula25` comment on the PR, `⚠️ REVERTED` in the summary — all
   captured verbatim.
3. **Re-queue proof.** Re-run acquisition on the fixtures repo: the reverted issue
   is **eligible** again (not skipped-merged) — `mainRevertsPr` working end-to-end.
4. **Cleanup.** Reset fixtures main to the seeded state; delete scratch branches.
5. **Record.** `docs/work/WI-6/verification.md` updated per
   verification-before-completion; LLM spend ledger: exactly one review-pass call
   (Task 6) + the Task-7 green run's usual fix/verification spend (existing loop
   cost, not new).
6. **Commit.** `docs(WI-6): pipeline-integration evidence — live green chain + canary-red revert/halt (FR-010)`

---

## Validation and rollback

- Every task: `npm run typecheck` (exit 0) + focused vitest file(s) + full
  `npm test` before its commit; the controller re-verifies RED empirically on a
  throwaway clone per the implement skill.
- Sequencing is rollback-safe: tasks 1–2 are independent leaves; 3 depends on 1;
  4 on 3; 5 on 4; 6 on 3; 7 on 4+5+6. Each commit leaves main-bound state green
  (default repos byte-identical until the profile flag exists and is set).
- Non-opted repos are pinned byte-identical at every checkpoint (explicit
  opted-out assertions in tasks 2, 3, 6) — a regression there is a blocking
  finding, not a nit.

## Out of scope (blocking-review reminders)

Merger-agent conflict resolution (FR-004 non-claim; named follow-up); plan-approval
tier; any spend on non-opted repos; any merge into the harness's own repository.
