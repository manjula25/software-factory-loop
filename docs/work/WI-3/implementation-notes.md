# WI-3 Implementation Notes

Controller log for `implement` on plan `docs/work/WI-3/implementation-plan.md`.
Worktree: `.claude/worktrees/wi-3`, branch `worktree-wi-3`, base `main` @ `bacb85a`.

## Task 1 — T1: Attachment discovery + confidentiality gate (FR-001, FR-002)

**Dispatch record.** Size M (4 new files, 2 edits + controller CLAUDE.md rows) · risk low
(additive; script-internal refactor) · time budget 45m (used ~12m leaf + ~10m controller)
· tool budget ~20 calls (used ~14 leaf) · evidence boundary: vitest unit seam only — no
Docker, no network, no loop CLI (non-claims below) · fixed point: baseline green at
`bacb85a` (typecheck 0, 8 files / 72 tests).

**Candidate identity.** `bfde1f5` — leaf implementer's six plan files, plus two
controller amendments applied pre-review (below), plus CLAUDE.md module-table rows.

**TDD evidence.** RED: both new test suites failed on module absence (`Cannot find
module './attachments.js'` / `'./onboard-profile.js'`), preserved in the leaf report.
GREEN: `npx vitest run src/attachments.test.ts src/onboard-profile.test.ts` → 15 passed
(14 leaf + 1 controller punctuation test). Focused verification at candidate:
`npm run typecheck` exit 0; `npm test` 10 files / 87 tests passed.

**Controller amendments (pre-review, on the leaf's flagged deviations).**
1. Trailing-punctuation strip in `discoverAttachmentUrls` (`TRAILING_PUNCTUATION`) +
   pinning test — the plan's literal regex captured `.`/`,`/`;` after a prose URL.
2. CLAUDE.md module-table rows for `src/attachments.ts` and `src/onboard-profile.ts`
   (CLAUDE.md's own same-PR rule; outside the leaf's allowed file list by design).
   Deviation 3 (double `onboardProfile` call in `scripts/onboard.ts`) accepted as-is —
   pure function, documented in-code.

**Reviews (sequential, same identity `bfde1f5`).**
- Specification review: **PASS** — zero blocking; three adjacent observations (double
  `onboardProfile` call; fetch-adjacent ticket criteria plan-scoped to T2;
  punctuation heuristic is controller-directed).
- Code-quality review: **APPROVED** — zero critical/important findings; reviewer
  re-ran `npm test` (87/87) and typecheck (clean) fresh on the candidate; constraints
  and PRD honesty confirmed (the slice only adds the mechanism that will enforce the
  gate — narrows nothing).

**Checkpoint accepted** — both sequential reviews on identity `bfde1f5`.

**Deviations from plan.** None beyond the two recorded amendments above; both are
behavior-additive within FR-001's stated boundary ("URLs embedded in prose").

**Non-claims.** `scripts/onboard.ts` refactored but not executed end-to-end (needs
Docker) — covered by typecheck + function-seam tests. The gate is a primitive here; it
is not yet wired into `runSingleIssue` (Task 2 does that), so FR-002's "zero network
requests on refusal / run stops before sandbox" is proven at T1 only vacuously — the
plan scopes those cases to Task 2's `loop.test.ts`.

**Follow-up queue (adjacent, not silent scope).**
- T2 RED list includes the two stubbed-fetch FR-002 criteria (plan-scoped, confirmed
  by spec review).
- (quality review, minor 1+2) `scripts/onboard.ts` double `onboardProfile` call and
  the `pending` variable name — cosmetic; revisit if profile shaping ever derives
  commands from run facts (then the pre-exec placeholder call would silently diverge).
- (quality review, minor 3) token-regex edge: URL immediately followed by
  punctuation-plus-text with no space captures trailing text; unpinned and not an
  FR-001 criterion — record only.
- Revisit `TRAILING_PUNCTUATION` only if a real user-attachment URL ever ends in a
  stripped character (asset IDs today do not).
