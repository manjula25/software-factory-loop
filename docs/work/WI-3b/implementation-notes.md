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
