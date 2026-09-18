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

