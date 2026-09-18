# WI-4 Verification

## WI-4 completion verification — final branch state (2026-09-18)

**Claim under test.** All three correctness-batch fixes from the WI-3b
follow-up queue are implemented, reviewed, and verified: (1) the nesting
guard refuses before any attachment fetch (zero network side effect),
(2) a surviving `loop/onboard` branch kills onboarding loudly instead of
silently reusing a stale fork (happy path re-proven live in Docker),
(3) one shared suite-summary definition governs the verification gate,
onboarding, and the preflight script (their prior disagreement resolved by
broadening to the counted-outcome set, verified fail-safe).

- Final head `8b93a83` (code identities `7687e9d`, `27421a6`, `0990db8`;
  the commit above the last is docs-only), working tree clean (untracked
  `.env` only — gitignored, never committed).
- `npm run typecheck` exit 0; `npm test` 10 files / 145 tests (baseline 137
  at `ce763cd`; net +8 permanent pins). Diff vs fixed point `ce763cd`:
  11 files, +407/−41.
- Every checkpoint (T1, T2, T3) passed sequential spec + quality reviews on
  pinned identities; RED empirically re-verified for T1 and T3 by the spec
  reviewers on throwaway clones; T2's mechanism check independently
  reproduced by its spec reviewer.
- Non-claims: no live preflight-check run (no test seam; logic shared with
  the live-proven onboarding path — see T3 entry); T2's pinned-branch loud
  path proven at the git-mechanism level, not by wedging the fixtures
  clone; no client data touched (hard constraint 3).

## Task 3 (T3) — one shared suite-summary definition — candidate `0990db8`

- Baseline at `c46e7a7` (T2 accepted): typecheck 0; 139 tests green.
- RED (leaf report; independently re-verified empirically by the spec
  reviewer on a throwaway worktree with only the test hunks applied to
  `0990db8~1`): 5 failed / 66 passed focused — the loop skipped-only pin
  (current code rejects `"4 skipped in 0.01s"` as unreadable: "expected
  undefined, received 'Verification failed — full-suite output is
  unreadable…'") + all 4 verify.test.ts pins (`SUITE_SUMMARY_RE` undefined
  at parent). The onboard-profile skipped-only pin passed at parent —
  correct narrowing guard, not claimed red.
- GREEN (controller, fresh at `0990db8`): focused 71/71 across the three
  suites; `npm run typecheck` exit 0; `npm test` 10 files / 145 tests
  (139 + 6).
- Specification review: **PASS**, zero blocking (regex effect-identical to
  the deleted token; gate broadening verified fail-safe at both callers;
  no circular import). Code-quality review: **APPROVED**, zero
  critical/important (three nits queued in implementation-notes).
- Both verdicts apply to `0990db8`; checkpoint accepted 2026-09-18.
- Non-claims: `scripts/preflight-check.ts` has no test seam — its changes
  (parseSuiteBaseline + argv repoDir) are verified by typecheck, reading,
  and review only; no live preflight run was executed in WI-4 (it requires
  a target repo with a recorded baseline; the fixtures repo qualifies but
  the run is Docker-cost for a script whose logic is now shared with the
  live-proven onboarding path).

## Task 2 (T2) — loop/onboard deletion fails loudly — candidate `27421a6`

- Baseline at `7687e9d` (T1 accepted): typecheck 0; 139 tests green.
- Mechanism check (leaf, throwaway /tmp git repo, preserved in report):
  absent branch → probe skips, exit 0, silent; branch pinned by a worktree
  → unguarded `-D` exits 1 with the real git error visible. Independently
  reproduced by the spec reviewer.
- Regression (controller, fresh at `27421a6`): `npm run typecheck` exit 0;
  `npm test` 10 files / 139 tests.
- Specification review: **PASS**, zero blocking — probe semantics and the
  critical edge (rev-parse sees worktree-pinned branches → loud path
  reachable in the WI-3b scenario) verified empirically by the reviewer.
- Code-quality review: **APPROVED**, zero critical/important (two nits
  queued in implementation-notes).
- Live proof (controller, Docker, zero LLM spend): onboarding against the
  fixtures repo → `suite exit: 0 / baseline failures (0) / profile
  written`; `loop/onboard` re-forked exactly at main `009a404`
  (`git merge-base --is-ancestor main loop/onboard` passed; both refs at
  `009a404`).
- Both verdicts apply to `27421a6`; checkpoint accepted 2026-09-18.
- Non-claims: the pinned-branch loud path was proven at the git-mechanism
  level and by reviewer reproduction, not by pinning the fixtures repo's
  branch inside a live onboarding run (would require deliberately wedging
  the fixtures clone's refs).

## Task 1 (T1) — nesting guard fires before the fetch — candidate `7687e9d`

- Baseline (worktree creation from `main` @ `ce763cd`): `npm run typecheck`
  exit 0; `npm test` 10 files / 137 tests passed; clean tree.
- RED (leaf report; independently re-verified empirically by the spec
  reviewer on a throwaway worktree with only the test hunks applied to
  `7687e9d~1`): 2 failed / 50 passed — (a) the adjusted guard test failed on
  `expect(fetchMock).not.toHaveBeenCalled()` ("Number of calls: 1" — current
  code fetches before the guard); (b) the new gates-on-discovered-URL test
  failed on `outcome.prUrl` being defined (old `staged.length` gating let a
  doomed-fetch run proceed body-only to a PR).
- GREEN (controller, fresh at `7687e9d`): `npx vitest run src/loop.test.ts`
  → 52/52; `npm run typecheck` exit 0; `npm test` 10 files / 139 tests
  (137 + 2 net new; the adjusted guard test is a modification, not an
  addition).
- Specification review: **PASS**, zero blocking (RED re-verified empirically;
  failure message/failureKind byte-identical; confidentiality gate still
  precedes the guard; all four required pins confirmed).
- Code-quality review: **APPROVED**, zero critical/important (no stale
  comment claims — old wording grepped gone; stubs/cleanup match existing
  patterns; two nits queued in implementation-notes).
- Both verdicts apply to `7687e9d`; checkpoint accepted 2026-09-18.
- Non-claims: no live run against a committed-`.loop-harness` repo (the
  guard remains unit-pinned at the spend seam; unchanged from WI-3b).
