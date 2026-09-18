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
