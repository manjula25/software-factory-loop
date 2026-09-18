# WI-6 Verification

Per-checkpoint evidence; refreshed wholesale by `verification-before-completion`
before code-review and delivery. Candidate identities are pinned per checkpoint.

## T1 — opt-in flag (FR-001)

**Claim.** `onboardProfile` records `autoMerge: true` when `--auto-merge` is passed,
omits the key when absent; no other behavior changes; default-repo profiles
byte-identical.

**Commands (controller, fresh on the final candidate, working tree vs `b8ec2a1`):**

- `npx vitest run src/onboard-profile.test.ts` → 10/10 passed, exit 0
  (includes the two new FR-001 tests: flag → `autoMerge === true`; absent →
  `"autoMerge" in profile === false`).
- `npm run typecheck` → exit 0.
- `npm test` → 10 files / 147 tests passed, exit 0 (baseline 145 + 2 new).

**RED evidence.** Leaf observed the flag-present test fail pre-GREEN
(`expected undefined to be true`, focused exit 1); the absent-case companion passed
pre-GREEN as expected (field did not exist). Controller did not re-derive RED on a
throwaway clone for this task: the failing assertion is deterministic on the
untouched base, and the focused suite was re-run fresh on the final tree.

**Boundary.** Profile-shaping seam only. Nothing reads `autoMerge` yet (consumers
arrive T3+); `scripts/onboard.ts` was not executed live (it writes to a target
repo; its serialization of the shaped object is covered by the unit seam). Not
claimed: any merge, canary, review-pass, or notification behavior.

## T2 — merged-PR dedup (FR-002)

**Claim.** A merged fix PR (head-branch or exact-token body match, same rule as
open PRs) means the issue is done: skipped, never re-admitted, its branch never
delete-and-retried — in queue mode and under the `--issue N` override. Open-PR and
closed-unmerged semantics unchanged; `prListArgs("open")` byte-identical to the old
`openPrListArgs()`.

**Commands (controller, fresh on the final candidate, working tree vs `5ed4590`):**

- `npx vitest run src/queue.test.ts src/loop.test.ts` → 81/81 passed, exit 0
  (8 new tests: merged head-branch skip, exact+case-insensitive token with
  gh-2/gh-21 non-match, merged-covered branch never deleted while an uncovered
  stale branch still is, closed-unmerged retry pinned, merged-before-open
  precedence, merged-args pin, queue summary `skipped-merged` surfacing, and the
  `runOverrideIssue` merged-skip).
- `npm run typecheck` → exit 0.
- `npm test` → 10 files / 155 tests passed, exit 0 (147 baseline + 8 new).

**RED evidence.** Leaf observed: 7 failing tests in `src/queue.test.ts`
(`skippedMerged` undefined; `prListArgs is not a function`) + 1 in
`src/loop.test.ts` (summary `skippedMerged` undefined), plus the controller-added
override test failing with kind "run" where "skipped-merged" was expected — all
deterministic on the base, all green on the final tree.

**Boundary.** Unit evidence at the acquisition/summary seams with stubbed gh deps.
No live `gh pr list --state merged` call (T7 territory). A merged-then-reverted PR
is still deduped away at this checkpoint — the `mainRevertsPr` guard is Task 4,
spec'd and tracked. Not claimed: any behavior of the merge machinery itself (T3+).

## T3 — merge machinery + conditional PR body (FR-003, FR-004 wiring)

**Claim.** On `autoMerge: true` profiles, after verification green and PR
creation (and after the verification sandbox closes — D3), the loop squash-merges
the PR via the `mergePr` seam; any merge failure records a loud `mergeFailure`
with the PR left open and the run continuing. Opted-out profiles: `mergePr` never
invoked, outcome and PR body byte-identical to pre-WI-6. Opted-in PR bodies state
the machine gate chain. Queue summary surfaces `MERGED`/`MERGE FAILED` lines.

**Commands (controller, fresh on the final candidate, working tree vs `14b8c32`):**

- `npx vitest run src/loop.test.ts` → 61/61 passed, exit 0 (6 new tests:
  merge-invoked-once opted-in, opted-out never-invoked + outcome/body pins,
  merge-failure fallback, both PR bodies, queue `mergedPrs`/`mergeFailures`
  surfacing with line ordering).
- `npm run typecheck` → exit 0.
- `npm test` → 10 files / 161 tests passed, exit 0 (155 + 6 new).

**RED evidence.** Leaf observed 4 failing tests pre-GREEN (mergePr called 0
times; body missing `canary`; `mergedPrs` undefined) — deterministic on the
base; the two opted-out pins passed pre-GREEN as expected (they pin today's
behavior).

**Boundary.** Unit evidence at the loop seam with a stubbed `mergePr`. The real
`gh pr merge`/`gh pr view` wiring is typechecked but NOT exercised live (T7).
Not implemented at this checkpoint by design: pre-merge review pass (T6 gap
comment marks the slot), canary/revert/halt/notify (T4), issue closing (T5).
`merged` means "merge command succeeded", not "canary green". The
`main()`-level override console behavior is untested (not an exported seam).

## T4 — canary, revert, halt, notify (FR-005/006/007)

**Claim.** After a successful merge on an opted-in profile, the loop syncs
main, runs the full suite in a fresh canary sandbox
(`loop/canary-<issue.id>` from main), and: green → outcome `merged` with
`canaryGreen: true`, queue continues; red (any failure ∉ baselineFailures,
install failure, or unreadable output — D2) → `revertMerge` of exactly the
merge commit, run halt via `failureKind: "harness"` (`QueueAbortedError`,
exit 1), exactly one `@<notifyHandle>` REVERTED comment on the PR (posted
without a mention when no handle is configured), a `⚠️ REVERTED` summary
section (id, PR, merge commit, revert commit or FAILED, canary evidence),
and the reverted issue re-queued (`mainRevertsPr` guard in `splitQueue` —
merged cover consulted only for the covering PR). Revert failure still
halts and notifies with the error recorded.

**Commands (controller, fresh on the final candidate, working tree vs `8be5b89`):**

- `npx vitest run src/loop.test.ts src/queue.test.ts` → 102/102 passed,
  exit 0 (15 new tests: canary sandbox lifecycle on `loop/canary-<id>` from
  synced main; green-continues vs red-reverts; red → revert with exactly the
  merge commit + halt + summary; @-mention comment once on red only;
  handle-absent comment + `notify handle not configured`; install-failure
  and unparseable-output red; `revertMerge` throw → still halted, failure
  recorded; `⚠️ REVERTED` summary text; reverted issue eligible again under
  `mainRevertsPr: true`; merged-not-reverted still `skippedMerged`).
- `npm run typecheck` → exit 0.
- `npm test` → 10 files / 176 tests passed, exit 0 (161 + 15 new).

**RED evidence.** Leaf observed the new chain tests fail pre-GREEN for the
stated reasons (deps/fields absent: `syncMain`/`revertMerge`/`commentOnPr`
not in `LoopDeps`, `mainRevertsPr` not in `QueueDeps`, no `reverted` on the
outcome/summary) — deterministic on the base. Controller re-ran everything
fresh on the final tree (above).

**Boundary.** Unit evidence at the loop/queue seams with stubbed
git/gh/sandbox deps. The real `git fetch`/`git revert`/`git push`/
`gh pr comment` wirings are typechecked but NOT exercised live (T7, incl.
the recorded follow-up on whether `mainRevertsPr` should fetch origin
first). CLI exit 1 asserted at the `runQueue`/`QueueAbortedError` seam —
`main()` is not an exported seam and its exit wiring is unchanged from T3.
Two spec-review minor notes recorded as follow-ups in
`implementation-notes.md`: green-canary result absent from summary text
(discharged in T5 — see below); `syncMain` throw propagates uncaught (no
revert/comment on that path — plan-D3-sanctioned loud failure, surfaced for
an owner decision). Not implemented at that checkpoint by design: issue
closing (T5), pre-merge review pass (T6 gap comment).

## T5 — issue closing on merge (FR-008)

**Claim.** At the end of the green auto-merge chain (D3: merge → canary →
close), a gh-sourced issue is closed via `LoopDeps.closeIssue`
(`gh issue close <n> --comment <body>`, number from the issue url) with a
comment naming the PR url, merge commit, and canary result. spec-doc /
plain-list sources are a no-op; the canary-red path never closes. A close
failure is recorded loudly (`closeFailure` on the outcome,
`closeFailures` + `ISSUE CLOSE FAILED` summary lines, guarded stderr on the
override path) but the outcome stays `merged` and the run continues.
`formatSummary`'s MERGED line now ends `(canary: green)` (T4 follow-up).

**Commands (controller, fresh on the final candidate, working tree vs `2597226`):**

- `npx vitest run src/loop.test.ts` → 78/78 passed, exit 0 (5 new tests:
  close-once-with-evidence on green gh-issue; spec-doc/plain-list no-op;
  red path never closes; close throw → loud record, outcome merged, queue
  continues; MERGED-line `(canary: green)` pin — plus the T3 ordering pin
  updated in place).
- `npm run typecheck` → exit 0.
- `npm test` → 10 files / 181 tests passed, exit 0 (176 + 5 new).

**RED evidence.** Leaf observed 3 failing tests pre-GREEN (closeIssue called
0 times where 1 expected; `closeFailures` summary undefined; MERGED-line
text without `(canary: green)`) — focused exit 1; the two negative-pin
tests (no-op sources, red path) passed pre-wiring as structurally expected.
Controller re-ran everything fresh on the final tree (above).

**Boundary.** Unit evidence at the loop seam with a stubbed `closeIssue`.
The real `gh issue close` wiring (and `issueNumberFromUrl`) is typechecked
but NOT exercised live (T7). Non-opted repos byte-identical (close sits
inside the autoMerge chain; MERGED lines only exist on merged outcomes).
The `main()`-level override stderr line is untested (not an exported seam).
Remaining from T4: T6 review pass (gap comment) and the `syncMain` throw
note for `verification-before-completion`.

## T6 — pre-merge review pass (FR-009, completes FR-004 ordering)

**Claim.** Between `createPr` and `mergePr` in the auto-merge chain (opted-in
repos only), one bounded cheap-model review pass judges the fix diff against
the report: `fixDiff` (`git diff main...<branch>`) → `buildReviewPrompt`
(three-verdict contract) → `assertNoSecrets` → `runReview` (single
`run({...})`, `maxIterations: 1` via the shared `boundedRunOptions` factory,
throwaway `loop/review` branch deleted in a finally) → `parseReviewOutput`.
Only an explicit `approve` reaches `mergePr`; wrong, uncertain (also what
unparseable output and any thrown step map to) blocks the merge with the PR
left open, a guarded skip comment posted, `REVIEW SKIP` summary lines, and
the run continuing. Opted-out repos never invoke the reviewer. FR-004's full
blocking order holds: verification → review → merge.

**Commands (controller, fresh on the final candidate, working tree vs `2d2f6cf`):**

- `npx vitest run src/queue.test.ts src/loop.test.ts src/sandcastle-adapter.boundary.test.ts`
  → 121/121 passed, exit 0 (10 new tests: parser verdict table + uncertain
  defaults; prompt build; approve → merge proceeds; wrong / unparseable /
  throw → mergePr never called + skip comment + queue continues; opted-out →
  reviewer never invoked; `REVIEW SKIP` summary surfacing; the shared
  `maxIterations: 1` bound asserted once).
- `npm run typecheck` → exit 0.
- `npm test` → 10 files / 191 tests passed, exit 0 (181 + 10 new).
- `git diff 2d2f6cf -- src/sandcastle-adapter.boundary.test.ts` → empty
  (boundary file byte-unchanged, still passing).

**RED evidence.** Leaf observed, pre-GREEN: parser tests — `TypeError:
parseReviewOutput is not a function` (focused exit 1, 2 failed/29 passed);
wiring tests — `buildReviewPrompt is not a function`, `runReview` called 0
times, `mergePr` called where never-expected (no gate), summary
`reviewSkipped` absent (focused exit 1, 6 failed/80 passed). The opted-out
test passed pre-change as expected. Controller re-ran everything fresh on
the final tree (above).

**Live exercise (plan step 5 — one real bounded model call, controller-run
2026-09-18).** Script: `docs/work/WI-6/evidence/review-exercise.ts` — the
exact production wiring against fixtures PR #15 (hand-opened; issue #14:
`parse_iso8601` ValueError on fractional-second Z timestamps; hand-authored
fix branch `fix/gh-14`, all four parse cases verified locally before push).

- prompt: 2886 chars (diff 1688 chars); provider `claude-via-proxy`
  (glm-5.2, the run's own cheap default — no new provider).
- verdict: **approve** (parseReviewOutput on real stdout; reviewer's
  reasoning named the root cause and both regression tests).
- wall: 18974 ms; `loop/review` branch deleted post-run (verified absent).
- cost estimate: ~0.75k prompt + ~0.4k completion tokens ≈ **~1.2k tokens
  total** on the cheap model — one call, `maxIterations: 1`.
- LLM spend ledger for WI-6 to date: exactly this one auxiliary call.

**Boundary.** Unit evidence at the parser/loop/summary seams with stubbed
reviewer deps + one live call as above. The full chain live (review verdict
actually gating a merge in Docker) is T7. `main()` console output not a unit
seam. Recorded follow-ups (implementation-notes T6): guard-ordering negative
test, throw-path branch-deletion test, `runSingleIssue` extraction at
threshold, `BoundedRunOptions` named type.



## T7 — pipeline integration (FR-010)

**Claim.** The full opt-in chain runs live, end-to-end, against the fixtures
repo in local Docker: fix run → fresh-sandbox verification → PR with the
gate-chain body → bounded pre-merge review → squash-merge → post-merge canary
on merged main → green: issue closed with an evidence comment; red:
auto-revert on main, run halt (exit 1), @-mention comment on the merged PR,
and the reverted issue eligible again on the next run.

**Candidate identity.** Worktree HEAD `7664e47` (both T4b defect fixes
included) for every run below; `npm test` 10 files / 195 tests and
`npm run typecheck` exit 0 fresh at this commit (T4b record).

### Step 1 — green chain, live (controller-run, 2026-09-18)

Command: `npm run loop -- --repo /home/bitcot/Documents/projects/loop-fixtures-py
--provider claude-via-proxy --issue 14`. Full log:
`evidence/t7-green-chain.log.3` (exit 0).

- PR #17 opened (gate-chain PR body: machine-merge wording, canary named) →
  real bounded review call → verdict `approve` → squash-merged
  (`88984fdc…`) → canary green on merged main → issue #14 closed with the
  FR-008 evidence comment naming PR, merge commit, and canary result.
- Independent end-state verification (never the run's own output):
  `gh pr view 17 --json state,mergeCommit` → MERGED @ `88984fd`;
  `gh issue view 14 --json state` → CLOSED with the evidence comment;
  `git log origin/main` → `88984fd` on top; no `fix/gh-14` branches (local or
  remote) and no open PRs.
- Runs 1–3 failed live and are recorded evidence for the two T4b defects
  (`evidence/t7-green-chain.log` — syncMain crash; `.log.2` — stale-ref
  "no commits"); the uncanaried PR #16 from run 2 was recovered by a manual
  `git revert` + push (`8f940ee`), which incidentally live-proved the
  `mainRevertsPr` re-queue rule before step 3 proved it deliberately.

### Step 2 — canary-red, live, ZERO LLM (controller-run, 2026-09-18)

Seeding (hand-authored, all pushed before the driver ran): fixtures main
commit A `453801a` — `tests/test_contract.py` pins the CURRENT
`parse_iso8601` contract (naive input is whole-seconds-only; fractional naive
input raises ValueError) so the suite stays green and the `[]` baseline
holds; issue #18 reports the uncovered gap as a user symptom;
`fix/gh-18` `95dfa37` is authored from pre-A main (fractional-naive support +
repro `tests/fixed-issues/test_gh_18.py`) — genuinely green on its own tree.

Command: `npx tsx docs/work/WI-6/evidence/canary-red-driver.ts`. Full log:
`evidence/t7-canary-red.log` (**exit 1** — the halt).

Zero-LLM boundary (documented in the driver header): stubbed =
`runFixRun` (returns the pre-authored branch + authored RED/GREEN blocks —
the fresh-sandbox verification gate still runs FOR REAL in Docker),
`runReview` (`approve`; the pass was live-exercised in T6), `listFixBranches`
(`[]`; real acquisition would delete the pre-authored branch as stale),
`runTriage` (never called). Everything else is the production wiring: real gh
acquisition + dedup, real Docker preflight/verification/canary sandboxes,
real git push/PR/merge/revert, real gh comment.

Verbatim results (lines from the log):

```
⚠️ REVERTED gh-18: pr https://github.com/manjula25/loop-fixtures-py/pull/19 merge 4ef7f69… revert eecb13a… — canary: canary new failures vs baseline on merged main: tests/test_contract.py::TestNaiveTimestampContract::test_naive_timestamp_with_fractional_seconds_raises
notify: @manjula25
Queue aborted — gh-18: ⚠️ REVERTED gh-18: … comment: posted; notify: manjula25
driver exit: 1
```

Independent end-state verification: PR #19 `state=MERGED` (`gh pr view`);
the PR comment body read via `gh api …/issues/19/comments` carries
`@manjula25 ⚠️ REVERTED:`, the merge commit, the canary evidence, the revert
commit, and the halt statement verbatim (FR-006/FR-007); `git log origin/main`
showed `Revert "… (#19)"` (`eecb13a`) on the squash merge (`4ef7f69`) on top
of A (`453801a`); issue #18 remained OPEN (the red path never closes);
no `fix/gh-18`/`loop/canary-gh-18` branches remained. The contract
contradiction — a failure NO pre-merge step can see, because the branch's
verification tree predates A — is exactly the base-moved class the canary
exists to catch (FR-005).

### Step 3 — re-queue proof (FR-006/D4 end-to-end)

Command: `npx tsx docs/work/WI-6/evidence/requeue-proof.ts` — the REAL
`listOpenIssues` + `splitQueue` (no stubs) against the post-revert state.
Log: `evidence/t7-requeue-proof.log`, exit 0:

```
merged cover: PR #19 (fix/gh-18) — without the revert guard, gh-18 would be skipped-merged
mainRevertsPr(#19): true
eligible: gh-18
RE-QUEUE PROVEN: gh-18 is eligible again
```

### Step 4 — cleanup

Fixtures main force-reset (`--force-with-lease`) to `88984fd` (the
pre-scenario seeded state, verified `main...origin/main` clean); issue #18
closed as a test artifact with an explanatory comment; no scenario branches
remain. No merge touched any repository but the fixtures repo.

### Canary evidence boundary (honest non-claim)

The canary is a model-less sandbox suite run and writes no log file of its
own under `.sandcastle/logs/` (only agent runs log there). Green-path canary
evidence is therefore indirect but structural: the FR-008 close comment is
constructed ONLY on the canary-green branch of `runSingleIssue`, the issue
close and merged-outcome only happen after it, and the run exited 0.
Red-path canary evidence is fully verbatim (the new failure is named in the
`⚠️ REVERTED` and `FAILED` summary lines — see step 2).

### LLM spend ledger (WI-6 total, honest)

- T6 review exercise: 1 bounded call, ~1.2k tokens (recorded in the T6
  section).
- Green chain (step 1): 4 fix-run agent executions (runs 1–4; runs 1 and 3
  produced no commits and failed before any PR), 2 review-pass calls
  (runs 2 and 4 — run 2's merged PR #16 was the one recovered by manual
  revert). This is the existing loop cost the plan named as "not new";
  fix-run token usage is not precisely metered by the POC (Sandcastle run
  logs retained under the fixtures repo's `.sandcastle/logs/`).
- Canary-red driver + re-queue proof: **zero** LLM calls (verified by
  construction — both agent-run seams stubbed; no provider invocation).
- Total auxiliary (new-surface) spend: 3 bounded review calls, ~3.6k tokens.

**Remaining risks / non-claims.** A canary-red driven by a real agent fix run
(rather than the pre-authored branch) is the same machinery with real spend
and was not separately exercised. `mainRevertsPr` reads `origin/main` without
an explicit fetch (fresh in the proof only because the revert was pushed from
the same clone) — recorded follow-up. Stale refs from HUMAN merges +
remote branch deletion on non-opted repos remain out of scope (FR-004
non-claims), to be named at delivery.

## Final completion verification (candidate `aa6f2e0`, 2026-09-18)

**Exact claim.** WI-6 — opt-in auto-merge (FR-001…FR-010) — is fully
implemented on branch `worktree-wi-6` at commit `aa6f2e0`: the harness-source
surface passes typecheck and the full vitest suite at the public seam; the
pipeline-integration surface is proven live in local Docker (green chain,
canary-red revert/halt, re-queue); opted-out behavior stays byte-identical;
the Sandcastle import boundary is untouched; every emitted string on the new
paths passes the secrets guard.

**Fresh proving commands (all run at `aa6f2e0`, clean tree, from the
worktree root; broad evidence):**

- `git rev-parse HEAD` → `aa6f2e0960964bc4b4e7571be827061aad1b2049`,
  branch `worktree-wi-6`, `git status --short` → empty.
- `npm run typecheck` → exit 0.
- `npm test` → **10 files / 195 tests passed**, exit 0 (baseline at plan
  approval was 10/145; +50 tests across T1–T6 and the T4b defect fixes).
- `git diff main...HEAD --stat` → 31 files, +3996/−45 (src/ + docs/work/WI-6
  planning and evidence artifacts); `git diff main...HEAD --
  src/sandcastle-adapter.boundary.test.ts` → **empty** (boundary file
  byte-unchanged, still passing in the suite above).
- `docker images sandcastle-loop` → `sandcastle-loop:latest` present (the
  image the live runs in the T7 section used; no rebuild needed — no
  Dockerfile change in this work item).
- Runtime/external evidence: carried by the T7 section (live gh/git/Docker
  runs with verbatim logs and independent end-state checks) — not re-run
  here; it was collected AT this candidate (`7664e47` tree = `aa6f2e0`
  minus docs-only commits; the code surfaces are identical, verified by
  `git diff 7664e47 aa6f2e0 --stat` → docs/work/WI-6 only).

**Prior unknowns reconciled.** Closed with evidence: T3 #1 (workflow.md loop
row re-checked — the auto-merge wording is now accurate with the full chain
landed); T4 #1 (canary green surfaced in the MERGED summary line — closed in
T5); T5 #3 (CLAUDE.md loop.ts row — closed in T6). Explicitly deferred with
recorded effect (all in implementation-notes follow-ups, targeted at the
pre-delivery cosmetics batch or the delivery notes): syncMain-throw
propagation and human-merge stale refs (FR-004 non-claims, to be named at
delivery), `mainRevertsPr` fetch freshness, guard-ordering negative test,
`CANARY_RED_*` dedup, `advanceUpstream()` extraction, `runSingleIssue`
extraction at threshold, `BoundedRunOptions` named type, throw-path
`loop/review` deletion test, fetch-ref-path divergence test, minor wording
nits. None is a material unknown for the completion claim; all are recorded
with owners (this work item's delivery notes / cosmetics batch).

**Non-claims (explicit).** No lint surface exists — nothing is claimed about
style beyond the review records. A canary-red driven by a REAL agent fix run
(pre-authored branch stands in) and merger-agent conflict resolution are
out of scope (FR-004 non-claims). The harness's own repository never
auto-merges (constraint 1) — nothing in this work item merges anything
outside the fixtures repo; verified in the T7 cleanup. Fix-run token usage
is not precisely metered by the POC. Cloud sandboxes are unclaimed
(constraint 6 — local Docker only, as evidenced).
