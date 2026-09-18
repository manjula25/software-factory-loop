# WI-3b Implementation Notes — WI-3 follow-up fixes

Controller log. Worktree: `.claude/worktrees/wi-3b`, branch `worktree-wi-3b`,
base `main` @ `f53be15` (WI-3 merged as PR #6). Origin: the non-blocking
follow-up queue recorded in `docs/work/WI-3/implementation-notes.md`; user
directed 2026-09-18 to fix the two substantive items plus the fixtures-profile
refresh before moving on.

## Diagnosis — the `.loop-harness/.loop-harness/` nesting (WI-3 T6 follow-up 1)

**Method.** The T6 fix worktrees were still on disk under the fixtures clone's
`.sandcastle/worktrees/` — both `fix-gh-3` and `fix-spec-titlecase-…` carry the
nested artifact. Compared contents, then traced the copy mechanism in the
pinned `@ai-hero/sandcastle@0.12.0` dist.

**Evidence.**
- Nested copy (`.loop-harness/.loop-harness/`) = current profile (300 B,
  cleared) + `attachments/` — exactly what `copyToWorktree` delivered.
- Outer `.loop-harness/profile.json` = the STALE pre-re-onboarding profile
  (396 B) — not a copy of anything in `repoDir` at run time.
- `git ls-tree` on both fix branches AND on `main`: `.loop-harness/profile.json`
  is COMMITTED — introduced by `50a24de` ("chore: harness project profile
  (onboarded)"), refreshed `4ce28a9`. This is the pre-WI-3 onboarding
  convention, before "never commit `.loop-harness`" existed.
- Dist (`chunk-VOG34SRF.js` `copyToWorktree`): `execFile("cp", [cowFlags, src,
  dest])` with `dest = <worktree>/.loop-harness`. GNU `cp -R src dest` with an
  EXISTING dest copies src INSIDE it → nesting.

**Root cause.** The worktree forks from `main`, which already contains
`.loop-harness/`; the copy destination therefore pre-exists. The T2c review's
"unreachable today" assumption failed precisely because the fixtures repo
predates the never-commit rule.

**Impact (worse than the recorded "harmless warning").** The prompt's promised
path `.loop-harness/attachments/<id>/<file>` did not exist in the sandbox —
the file sat one level deeper. The live runs succeeded only because the
excerpt is inlined in the prompt.

**Chosen fix: loud guard, not a workaround.** When attachments must be
delivered and the base branch has `.loop-harness` committed, abort loudly with
remediation (zero sandbox, zero agent spend) — matching the repo's
loud-over-silent philosophy and the stale-profile abort precedent. The
alternative (rename the staging dir to a never-committed name) was considered
and rejected: bigger blast radius, and it would leave the committed stale
profile riding every fix branch silently. Repo-side remediation (remove
`.loop-harness` from fixtures main) is recorded below as the instance fix.

## Task 1 — T1: nesting guard + slug `--` separator (two commits)

**Dispatch record.** Size M (4 src files) · risk medium (new refusal path
adjacent to the gate) · time budget 45m · tool budget ~20 calls · evidence
boundary: vitest seam only — no Docker, no network · fixed point: `f53be15`
(typecheck 0, 129 tests; baseline recorded fresh in the worktree).

**Brief summary.**
1. New `LoopDeps.pathCommittedOnBranch(repoDir, branch, path)` (git ls-tree);
   in `runSingleIssue`, when `staged.length > 0`, refuse loudly if
   `pathCommittedOnBranch(repoDir, "main", ".loop-harness")` — queue-level
   abort mirroring the stale-profile pattern, message naming root cause +
   remediation, zero spend. Test factories default the dep to false.
2. Duplicate-slug counter separator `-2` → `--2` in both `parseSpecDoc` and
   `parsePlainList` (slugify output never contains `--`, so counter ids can
   never collide with literal "Foo 2" ids). Fixes WI-3 T3 follow-up 1 /
   T4 follow-up 3; supersedes the "grilling before FR-007" trigger by
   adopting the collision-proof scheme the T4 review proposed.
3. Fold-in (same file): reword the T7 `scanText` comment's two inaccurate
   rationales (WI-3 T7 follow-up 1) — no behavior change.

**Candidate identities.** `d27f2cf` (guard + fold-ins), `02e8064` (slug
separator) — leaf's four files, no controller amendments. One flagged scope
note accepted: the fold-in also aligned the PIN test's comment in
`src/loop.test.ts` (allowed file, behavior unchanged).

**TDD evidence (leaf, preserved in report).** RED fix 1: single-issue test
failed because the run opened a PR instead of aborting; queue test failed with
no QueueAbortedError. RED fix 2: collision tests failed showing the live bug
(`spec-foo-2` duplicate counter identical to literal "Foo 2" id) — 4 failed /
11 passed before the change. GREEN: focused 50/50 (loop) and 15/15 (issues);
controller re-verified fresh: 65/65 focused, `npm run typecheck` exit 0,
`npm test` 10 files / 133 tests (129 + 4).

**Reviews (sequential, identity `02e8064`).**
- Specification review: **PASS**, zero blocking. Reviewer independently
  re-verified RED empirically (test hunks applied onto base in a throwaway
  clone — exactly the 6 tests fail as expected) and 133/133 + typecheck 0.
  Guard placement, harness-level semantics, false-fire/silent-miss checks,
  `--` distinctness by construction, and downstream consumers (reproTestPath,
  fixBranch, dedup regex) all confirmed. Adjacent: WI-3 spec line 136 still
  documents the old `-2` scheme (revision note added by the controller, below);
  hardcoded `"main"` consistent with the existing baseBranch assumption.
- Code-quality review: **APPROVED**, zero critical/important. Real dep's
  raw-throw error behavior consistent with sibling deps; counter-block
  duplication judged the right ponytail rung; no stale comment claims (grep
  clean); tests at the right seams. Two minors queued (below).

**Checkpoint accepted** — both sequential reviews on identity `02e8064`
(2026-09-18).

**WI-3b follow-up queue.**
1. (quality, minor) The nesting guard runs after `fetchAndStageAttachment` —
   a doomed run still performs the network fetch and leaves staged
   (gitignored) files. Moving the check before the fetch loop, gated on
   `attachmentUrls.length > 0`, would make refusal zero-side-effect. Low
   value (staged files are inert); fold into the next task touching the
   staging path.
2. (quality, minor) Guard's hardcoded `"main"` must move together with
   `baseBranch: "main"` (src/loop.ts:359) if the base ever becomes
   configurable. Record-only.
3. (spec, adjacent) Old-scheme `*-2` artifacts (pre-change branches/PRs) will
   not dedup-match `--2` ids — none exist on the fixtures repo; record-only.

**Spec amendment (controller, docs).** `docs/work/WI-3/specification.md`
line 136 documents the literal `-2` collision counter; the `--2` scheme
supersedes it (this work item, T1 fix 2). A revision note is added to the
spec text rather than rewriting history — WI-3 is merged; the note keeps the
traceability chain honest.

## Task 2 — T2: onboarding fresh-fork + green-repo acceptance (live-diagnosed)

**How the third loose end (profile refresh) exposed two new defects.** The
fixtures remediation proceeded: pulled main (PR #12 merge `d9f8c21`), then
`git rm -r --cached .loop-harness` + `.gitignore` entry, committed `009a404`,
pushed. The onboarding re-run then misbehaved twice, both reproduced live:

1. **Stale base branch.** Onboarding creates a sandbox from a worktree of
   branch `loop/onboard`, which is never deleted after a run; Sandcastle
   reuses an existing branch rather than re-forking from HEAD. Today's re-run
   tested yesterday's code (`loop/onboard` sat at `08e53d4`, pre-PR-12) and
   recorded the already-fixed titlecase test as a baseline failure. Confirmed:
   `git merge-base --is-ancestor d9f8c21 loop/onboard` failed; deleting the
   branch changed the outcome.
2. **Born-red assumption.** With a fresh fork, the suite is fully green (all
   seeded bugs merged: gh-1, gh-2, gh-10, gh-3) — and
   `scripts/onboard.ts:46-52` REFUSES: "expected a born-red suite, got exit 0
   with 0 failures". A green target repo is legitimate; the guard's real
   intent (detect a sandbox where the test command executed nothing) must be
   an execution-evidence check instead.

**Dispatch record.** Size S-M (3 files) · risk medium (onboarding feeds the
baseline every verification gate trusts) · time budget 30m · tool budget
~15 calls · evidence boundary: unit seam for the new
`parseSuiteBaseline`/`SuiteDidNotRunError` helper; the script's branch-delete
wiring and the end-to-end green onboarding verified live by the controller
afterwards (Docker, zero LLM spend) · fixed point: `5e8ebb5` (typecheck 0,
133 tests).

**Brief summary.** (A) `src/onboard-profile.ts` gains
`parseSuiteBaseline(exitCode, stdout): string[]` — moved pytest-failure
parsing, throws `SuiteDidNotRunError` when stdout has no pytest summary line;
green suite returns `[]`. (B) `scripts/onboard.ts` imports the helper,
best-effort `git branch -D loop/onboard` before `createFixSandbox` (one-line
comment owning the observed staleness), graceful 0-failure output.

**Candidate identity.** `d60e041` — leaf's three files, no controller
amendments. One accepted premise-level deviation: `parsePytestFailures`
actually lives in `src/verify.ts` (not the script), so the helper imports it
— zero duplication, `src/verify.ts` and its other callers untouched.

**TDD evidence.** RED: 2 failed on missing exports (`parseSuiteBaseline` not
a function; `SuiteDidNotRunError` undefined). GREEN (controller, fresh):
`npx vitest run src/onboard-profile.test.ts` → 7/7; `npm run typecheck`
exit 0; `npm test` 10 files / 137 tests (133 + 4).

**Reviews (sequential, identity `d60e041`).**
- Specification review: **PASS**, zero blocking. Fresh-fork delete covers the
  observed bug; empty baseline verified SAFE downstream (every post-fix
  failure counts as new — conservative; a later-red repo flags stale).
  Adjacent: catch-all swallow could silently reintroduce staleness if a
  preserved worktree holds the branch (downstream stale-profile preflight is
  the loud net — T6 attempt 1 proved it); recommend narrowing the catch or
  post-verifying deletion → queued. SUMMARY_TOKEN heuristics reviewed
  (`-q`, mixed, pytest-8 banners, "no tests ran" correctly throws).
- Code-quality review: **APPROVED**, zero critical/important. Conventions
  held (named error with `name`, JSDoc, evidence-style comments); import
  direction sensible, no cycle/middle-man; tests honest. Minor queued:
  `deselected`-only runs throw SuiteDidNotRunError — arguably correct
  (nothing executed); conscious decision on record here: ACCEPTED as
  intended (a run that executes nothing must not produce a baseline).

**Checkpoint accepted** — both sequential reviews on identity `d60e041`
(2026-09-18).

**Live end-to-end proof (controller, Docker, zero LLM spend).** Ran the fixed
script from the wi-3b worktree against the fixtures repo:
`suite exit: 0 / baseline failures (0) / profile written`. `loop/onboard`
forked fresh at `009a404` (latest main — confirmed via merge-base); profile
now records `baselineFailures: []`, `confidentialityCleared: true`. The third
loose end (profile refresh) is CLOSED with the correct baseline.

**WI-3b follow-up queue (additions).**
4. (spec review) Narrow the `git branch -D loop/onboard` catch to
   "branch not found", or `git rev-parse --verify` after the attempt and
   throw if it survived — removes the one silent path back to stale-fork
   behavior.
5. (quality review, decided) `deselected`-only suite output throws
   SuiteDidNotRunError — accepted as intended.
6. (leaf adjacent) `scripts/preflight-check.ts` parses suite output with bare
   `parsePytestFailures` (no execution-evidence guard) — same treatment when
   next touched.
7. (quality nit) node:fs / node:child_process import ordering in
   scripts/onboard.ts vs loop.ts's alphabetical convention.
8. (branch spec review) `SUMMARY_TOKEN` (onboard-profile) accepts
   `skipped|xfailed|xpassed|errors` as execution evidence while the
   verification gate's `SUITE_SUMMARY_RE` (loop.ts) accepts only
   `passed|failed|error` — a skipped-only suite onboards with an empty
   baseline but every later verification is rejected as unreadable. Fold
   into follow-up 6's unification of suite-output parsing.
9. (branch standards review, cosmetic) `SUMMARY_TOKEN` names a regex
   pattern, not a token — rename to `SUMMARY_PATTERN` when next touched.
   Branch review also re-flagged the slug-dedup extraction (matches WI-3's
   recorded follow-up); CLAUDE.md module-table clause resolved in-PR.
