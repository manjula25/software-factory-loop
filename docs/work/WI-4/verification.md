# WI-4 Verification

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
