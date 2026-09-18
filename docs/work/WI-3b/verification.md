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

## Task 2 (T2) — onboarding fresh-fork + green-repo acceptance — candidate `d60e041`

- Baseline at `5e8ebb5` (T1 accepted): typecheck 0; 133 tests green.
- RED (leaf, preserved): 2 failed on missing exports. GREEN (controller,
  fresh): 7/7 focused; typecheck 0; `npm test` 137/137 (133 + 4).
- Specification review: **PASS**, zero blocking (empty-baseline downstream
  safety verified; stale-catch residual queued with the downstream
  stale-profile net noted). Code-quality review: **APPROVED**, zero
  critical/important (deselected-only throw consciously accepted).
- Both verdicts apply to `d60e041`; checkpoint accepted 2026-09-18.
- Live proof (controller): onboarding re-run against the fixtures repo from
  this worktree → `suite exit: 0`, `baseline failures (0)`, profile written;
  `loop/onboard` forked fresh at `009a404`; profile =
  `{ baselineFailures: [], confidentialityCleared: true, … }`.
- Non-claims: branch-delete failure path (preserved worktree holding the
  branch) not exercised live — unit/logic-reviewed only.

## Fixtures repo remediation — observed results (executed 2026-09-18)

- `git pull --ff-only` → `d9f8c21` (PR #12 merge present).
- Untrack commit `009a404` pushed to `main`: `.loop-harness/profile.json`
  deleted from the index, `.loop-harness/` added to `.gitignore`; working
  tree clean afterwards (profile now untracked + ignored).
- Onboarding attempts: (1) pre-fix code against stale `loop/onboard` →
  recorded the already-fixed titlecase test as baseline (defect reproduced);
  (2) pre-fix code after branch deletion → refused the green repo (defect
  reproduced); (3) fixed code (`d60e041`) → clean green onboarding, correct
  profile, fresh fork. Zero LLM spend in all three (Docker-only).

## WI-3b completion verification — final branch state (2026-09-18)

**Claim under test.** Both WI-3 follow-up fixes (nesting guard + slug
separator) and the two live-diagnosed onboarding defects are implemented,
reviewed, and — where the fix is observable without client data — proven
live; the fixtures repo is remediated and its profile fresh.

- Final head `a578f40` (code identity `d60e041`; the two commits above it are
  docs-only), working tree clean (`git status --short` empty).
- `npm run typecheck` exit 0; `npm test` 10 files / 137 tests (baseline 129
  at `f53be15`; net +8 permanent pins). Diff vs fixed point:
  10 files, +481/−21.
- Nesting root cause: diagnosed from preserved artifacts + dist reading;
  guard unit-pinned at the spend seam; instance remediated on fixtures
  (`009a404`).
- Profile refresh: closed with the CORRECT baseline (empty) — verified by
  the live run above.
- Non-claims: no live fix-run against a committed-`.loop-harness` repo was
  performed to observe the guard firing (unit-pinned; the fixtures repo no
  longer exhibits the condition — by design).
