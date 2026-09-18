# WI-3b Verification

## Task 1 (T1) — nesting guard + slug `--` separator — candidates `d27f2cf`, `02e8064`

- Baseline (worktree creation from `main` @ `f53be15`): `npm run typecheck`
  exit 0; `npm test` 10 files / 129 tests passed.
- RED (leaf report; independently re-verified by the spec reviewer on a
  throwaway clone applying only the test hunks to base): guard tests failed
  with the run proceeding to a PR / no queue abort; collision tests failed
  showing the live `spec-foo-2` counter id identical to a literal "Foo 2" id
  (4 failed / 11 passed in the issues suite pre-change).
- GREEN (controller, fresh at `02e8064`): `npx vitest run src/loop.test.ts
  src/issues.test.ts` → 65/65; `npm run typecheck` exit 0; `npm test`
  10 files / 133 tests (129 + 4).
- Specification review: **PASS**, zero blocking (adjacent: WI-3 spec line 136
  superseded — revision note added; hardcoded `main` consistent with existing
  assumption).
- Code-quality review: **APPROVED**, zero critical/important (two minors
  queued: guard fires post-fetch, `main` hardcode pairing).
- Both verdicts apply to `02e8064`; checkpoint accepted 2026-09-18.
- Non-claims: no live run with a committed-`.loop-harness` repo (the guard is
  unit-pinned at the spend seam; the fixtures repo is remediated separately,
  below); `pathCommittedOnBranch`'s git behavior verified by reading, not by a
  live invocation in these tests.

## Fixtures repo remediation (instance fix for the nesting root cause)

Recorded here on completion; executed against
`/home/bitcot/Documents/projects/loop-fixtures-py`:

- `git rm -r --cached .loop-harness` + `.gitignore` entry + commit + push to
  `main` — removes the committed destination that caused the nesting.
- Onboarding re-run (`npx tsx scripts/onboard.ts <fixtures>
  --confidentiality-cleared`, Docker-only, zero LLM spend) — refreshes the
  baseline for the merged gh-3 fix (titlecase now passes on main), resolving
  the stale-profile condition noted after PR #12 merged.

(Append observed outputs below after execution.)
