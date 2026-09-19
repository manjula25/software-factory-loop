# WI-12 — Verification record

## Candidate identity

- Branch `worktree-wi-12`, candidate **`4b09d97`** ("docs(WI-12): T5 module row + implement close-out notes"), base `003fbd1` (post-ponytail plan, local main).
- Ancestry: `git merge-base` is the base itself; 11 commits, tree clean at time of verification.
- Evidence boundary: **harness source only** (`src/`, vitest at the public seam). No pipeline/Docker run in this batch (spec non-claim).

## Exact claim

1. **FR-001:** an opted-in uncanaried merge (post-merge sync failure) with a throwing early sandbox close carries the early reason as `outcome.teardownFailure`, rendered by the existing queue FAILED-line `(teardown: …)` suffix and single-issue report `sandbox teardown failed:` stderr line; the failure string, failureKind, halt, and exit codes are unchanged; clean-teardown uncanaried runs render exactly as before.
2. **FR-002:** with a notify handle configured, the ⚠️ REVERTED failure line renders `notify: @<handle>`; the absent-arm vocabulary and both sibling surfaces are unchanged.
3. **FR-003:** the reverted-path two-origin lift (early reason at outcome level, canary home clean, FAILED suffix names the early reason) is pinned at the seam, with zero production change attributable to this FR.
4. **FR-004:** preflight-wins precedence when both early closes throw is pinned at the seam, with zero production change attributable to this FR.
5. **Gates:** `npm run typecheck` exit 0; `npm test` 10 files / 223 tests (baseline 219 + 4 new), all passing.
6. **Changed paths:** `src/loop.ts` (two hunks), `src/loop.test.ts`, `CLAUDE.md` (one row wording), `docs/work/WI-12/*` only.

## Proving commands (all fresh, 2026-09-19, at `4b09d97`)

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `npm run typecheck` | 0 | `tsc --noEmit`, no output |
| 2 | `npm test` | 0 | 10 files passed (10), 223 tests passed (223), 1.24s |
| 3 | `npx vitest run src/loop.test.ts -t "WI-12" --reporter=verbose` | 0 | 5 passed, 110 skipped: the four new pins (q2)/(f3)/(r)/(e3) all ✓, plus (f2) whose supersession title references WI-12 FR-002 |
| 4 | `git diff --stat 003fbd1..4b09d97` | 0 | CLAUDE.md +2/-2 lines (1 row), docs/work/WI-12/implementation-notes.md +114, src/loop.test.ts +129/-2ish, src/loop.ts +13/-4 — exactly the claimed path set |
| 5 | `git diff 003fbd1..4b09d97 -- src/loop.ts` (inspected) | — | Production delta is exactly two changes: (a) the FR-001 conditional spread + comment on the uncanaried return; (b) the FR-002 present-arm `@${handle}` + comment rewrite. Nothing else. |
| 6 | `git diff 5753e2e..53cb85b --stat` (T3/T4 ranges) | 0 | T3: src/loop.test.ts only (+44/-1); T4: src/loop.test.ts only (+29) — zero production change attributable to FR-003/FR-004 |

Focused evidence labels: #3 focused (one file, the changed seam); #2 broad (all harness-source surfaces); #1 broad static. #4-#6 are inspections (identity/accounting), not behavioral.

## Per-FR evidence map

- **FR-001** → test (q2) (RED observed at implementation: `outcome.teardownFailure` undefined; GREEN in `4015205`): single-issue outcome + report stderr + queue FAILED suffix + halt (`QueueAbortedError`) all asserted. Clean-teardown byte-identity: the pre-existing uncanaried pins ((n)/(o), comment-failed variant) are unmodified in the diff (#4) and pass (#2).
- **FR-002** → test (f3) (RED observed: bare rendering) pins `notify: @manjula25` at the outcome seam; (f2)'s absent-arm assertions unchanged and passing; sibling @-pins ((n)/(o), queue REVERTED line) unmodified and passing. The single sanctioned pin supersession ((f2) contrast arm) is in the same commit `d37c171` as the production change.
- **FR-003** → test (r) passed against unchanged code on first run (no RED by design — characterization); #6 proves T3's range touches no production file.
- **FR-004** → test (e3) same: passed first run; #6 proves T4's range is test-only.
- **Sanctioned-pin audit** (#4 + spec's non-functional constraint): exactly one existing-test assertion changed ((f2) contrast arm, bare→@) plus its comment/title marking; no other breaking pin (full suite green with zero other edits).

## Unknowns reconciliation

- No material unknowns were open at implementation start (spec had none; decisions d1/d2 pre-approved). Adjacent findings A1/A2 (T1 spec review) are **deferred as follow-up ledger entries** in implementation-notes.md — effect: optional coverage niceties only; owner: future work-item triage. Not defects; not scope.

## Remaining risks

- None behavioral identified. The reverted line's present-handle rendering changed shape (bare→@); any consumer matching the exact old string would notice — all in-repo consumers are pinned green; external consumers are a stated non-claim (this repo is the only deployment surface known).

## Non-claims

- No pipeline/integration run (no Docker, no seeded buggy repo) — harness-source surface only, per spec.
- The canary-only report-line pin (WI-11 review A1's optional follow-up) is deliberately NOT added.
- The merged-path both-early+canary triple-failure case is NOT covered (FR-004 non-claim).
- No claim about fixtures issue #26 or any PRD out-of-scope growth item.
- Human merge decision (hard constraint 1) untouched — this batch changes no merge policy.

## Candidate-change rule

If the candidate moves past `4b09d97`, every behavioral entry above is invalidated and must be re-run.
