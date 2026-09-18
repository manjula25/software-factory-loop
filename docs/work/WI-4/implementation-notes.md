# WI-4 Implementation Notes — correctness batch from the follow-up queue

Controller log. Worktree: `.claude/worktrees/wi-4`, branch `worktree-wi-4`,
base `main` @ `ce763cd` (WI-3b merged as PR #7). Origin: the WI-3b follow-up
queue (`docs/work/WI-3b/implementation-notes.md`, items 1, 4, 6, 8, 9);
user scoped WI-4 to the correctness batch 2026-09-18 (cosmetics deferred).

**Baseline (worktree creation).** `npm run typecheck` exit 0; `npm test`
10 files / 137 tests passed; working tree clean.

## Scope — three slices

1. **T1 — guard pre-fetch** (queue item 1): move the nesting guard before the
   attachment fetch loop in `runSingleIssue`, gated on
   `attachmentUrls.length > 0` instead of `staged.length > 0`. Known semantic
   change, accepted: a run where every fetch would have failed previously
   proceeded body-only; now any attachment-bearing issue on a
   committed-`.loop-harness` repo refuses before any network side effect —
   the queue item's stated intent ("zero-side-effect refusal").
2. **T2 — branch-D catch** (queue item 4): replace the catch-all around
   `git branch -D loop/onboard` in `scripts/onboard.ts` with a
   rev-parse-existence check + unguarded delete, so a branch that survives
   deletion fails loudly instead of silently reintroducing stale-fork
   behavior.
3. **T3 — suite-output parsing unification** (queue items 6, 8, 9): one
   shared summary-token definition in `src/verify.ts` (the existing
   suite-output parsing home), exported and used by `parseSuiteBaseline`
   (onboard-profile), the verification gate (`SUITE_SUMMARY_RE` in loop.ts),
   and `scripts/preflight-check.ts` (which also gets the execution-evidence
   guard instead of bare `parsePytestFailures`). Unified semantics: the full
   counted-outcome token set (`passed|failed|error|errors|skipped|xfailed|
   xpassed`) is execution evidence at EVERY seam — the gate broadens to
   match, so a skipped-only suite is readable downstream (queue item 8's
   disagreement resolved in that direction; the old narrow gate rejected
   output the onboarding seam had already accepted). `SUMMARY_TOKEN`
   disappears (queue item 9's rename resolves by consolidation).

Record-only items (2, 3, 5) and the cosmetics batch stay on the WI-3b queue;
not WI-4 scope.

## Task 1 — T1: nesting guard fires before the fetch

**Dispatch record.** Size S (2 files) · risk medium (refusal path adjacent to
the confidentiality gate) · time budget 30m · tool budget ~15 calls ·
evidence boundary: vitest seam only — no Docker, no network · fixed point:
`ce763cd` (typecheck 0, 137 tests; controller-fresh).

**Candidate identity.** `7687e9d` — leaf's two files (src/loop.ts,
src/loop.test.ts), no controller amendments. Leaf report noted baseline as
136; controller's fresh baseline was 137 and post-change 139 = 137 + 2 net
new tests (the third "new" test was a modification of the existing guard
test) — leaf's count was its own miscount, no discrepancy in the tree.

**TDD evidence (leaf, preserved).** RED: 2 failed / 50 passed — the adjusted
guard test (fetch WAS called once before the guard) and the new
gates-on-discovered-URL test (old `staged.length` gating let a doomed-fetch
run proceed body-only to a PR). GREEN (controller, fresh): 52/52 focused;
typecheck exit 0; `npm test` 10 files / 139 tests.

**Reviews (sequential, identity `7687e9d`).**
- Specification review: **PASS**, zero blocking. Reviewer empirically
  re-verified RED on a throwaway worktree (test hunks onto `7687e9d~1`:
  exactly the two tests fail); failure message and failureKind byte-identical
  to the old block; confidentiality gate still precedes the guard (correct
  precedence); all four required properties pinned (fetch never invoked,
  gate on discovered URL, inert case proceeds, queue-abort preserved).
  Adjacent (non-blocking): uncleared profile reports confidentiality first —
  pre-existing ordering, arguably correct precedence.
- Code-quality review: **APPROVED**, zero critical/important. No stale
  comment claims (old wording grepped gone); line 413's unrelated
  `staged.length > 0` correctly left alone; stubs/cleanup match existing
  patterns. Minors queued (below).

**Checkpoint accepted** — both sequential reviews on identity `7687e9d`
(2026-09-18).

**T1 follow-ups (non-blocking).**
1. (nit) "WI-4 T1:" prefixes inside `it()` names; siblings put the ticket
   tag in the `describe` title.
2. (nit) mild test-skeleton duplication vs the pre-existing guard test;
   the `existsSync` zero-staging assertion could be shared.
