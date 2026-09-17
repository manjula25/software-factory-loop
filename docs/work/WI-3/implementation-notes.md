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

## Task 2 — T2: Attachment fetch, delivery, loud degrade (FR-003, FR-004; FR-002 wired)

**Dispatch record.** Size M-L · risk medium (core `runSingleIssue` path + `QueueSummary`
shape) · time budget 60m (used ~11m leaf) · evidence boundary: vitest seam with
`vi.stubGlobal("fetch")`; no Docker/network/CLI · fixed point: 87 tests + typecheck 0 at
`bfde1f5`/`2f740b7` · intended candidate: 5 files, commit per plan.

**Candidate identity.** `e5523d9` — leaf's five files, no controller amendments needed
(both leaf-flagged judgment calls accepted after direct inspection, below).

**TDD evidence.** RED: `npx vitest run src/attachments.test.ts src/loop.test.ts` →
exactly the 12 new cases failed (39 pre-existing passed); preserved in leaf report.
One wrong-reason RED (callback-style `mkdtemp` import) fixed in the test before the
final RED run. GREEN: same command 51/51. Focused verification at candidate:
typecheck 0; `npm test` 10 files / 99 tests.

**Controller inspection findings.** Gate refusal sits before `assertNoSecrets`/preflight
(zero spend, no `failureKind` → queue continues); per-URL failure isolation; excerpt
rides the existing prompt guard; `copyToWorktree` conditional; fetch-failure `reason`
strings never emitted (only the URL).

**Leaf deviations accepted by controller.**
1. `buildAttachmentExcerpt(content, stagedPath)` — the pinned separator names the
   full-file path, so the path parameter is required; plan's "(no parameter)" meant no
   line-count parameter (ponytail rec 3's intent).
2. Manual 3xx re-fetch in `fetchAndStageAttachment` (cap 5 hops) — inert under real
   `fetch` (native follow never surfaces 3xx); exists so FR-003's hop-level no-auth
   criterion is observable under a stub. No headers are set on any hop either way.
3. Environment artifact: leaf symlinked worktree `node_modules` → main checkout's
   (gitignored; resolution would find the parent's anyway — harmless).

**Reviews (sequential, identity `e5523d9`).**
- Specification review: **PASS** — zero blocking; adjacent: excerpt head/tail overlap
  for 21–40-line content, trailing-newline line count, extension-less basenames from
  asset-id URLs (identical basenames would overwrite — spec silent), lossy excerpt
  decode (bytes on disk unaffected).
- Code-quality review: **APPROVED** — zero critical. Two important adjacent findings:
  1. **Attachment bytes could ride the PR**: staged bytes land in the fix worktree and
     the prompt says "Commit everything" — an agent resolving that as `git add -A`
     commits the client log onto `fix/<id>` and pushes it to GitHub. A third-party
     transmission the AI-API clearance doesn't cover. Follow-up: gitignore
     `.loop-harness/attachments/` at onboarding and/or tighten the prompt's commit
     instruction. Queued as **T2b** (see below), recommended before T6's live runs.
  2. `new URL(input.url)` sits outside the try in `fetchAndStageAttachment` — latent
     contract disagreement ("Never throws"); unreachable via discovery's regex.
- Minor: exactly-20-lines-with-trailing-newline doesn't pass verbatim (honest degraded
  output, full file always staged).

**Checkpoint accepted** — both sequential reviews on identity `e5523d9`.

**T2b follow-up (owner approved 2026-09-17, "do it now").** Tighten the fix-prompt
commit instruction to name `.loop-harness/` as never-committed, move `new URL` inside
the try, and write a `.loop-harness/attachments/<id>/.gitignore` (`*`) at staging
time. Dispatched size S / risk low / 20m budget (used ~30m).

- RED: 3 new cases failed as predicted (ENOENT .gitignore; malformed-URL throw; old
  prompt text). GREEN: 54/54 targeted, 102/102 full, typecheck 0.
- Candidate `d230413`; spec review **PASS**, quality review **APPROVED** — both on
  `d230413`; checkpoint accepted 2026-09-17. Evidence in `verification.md`.

**T2c follow-up (controller-initiated, runtime-blocking for T6).** The T2b quality
review flagged two attachment-delivery issues the controller verified against the
pinned `@ai-hero/sandcastle@0.12.0` dist (`chunk-VOG34SRF.js`, `copyToWorktree`):
1. `cp -R src dest` creates no dest parent directories — our nested stagedPaths
   (`.loop-harness/attachments/<id>/<file>`) would fail the fix run at copy time.
2. The staging `.gitignore` never reached the fix worktree (only explicit stagedPaths
   were copied), so the in-worktree defense was prompt-only.

Fix: pass the top-level `.loop-harness` directory in `copyToWorktree` instead of
per-file paths — the dest parent (worktree root) exists, and the whole dir travels,
bringing the `.gitignore` (and the machine-local profile) with it; prompt rule still
forbids committing anything under `.loop-harness/`. Also corrects the overstated
comment/test naming from T2b.

**T2c dispatch record.** Size XS-S (2 code lines + comments + pinned test) · risk
medium (runtime-critical delivery path, but behavior is fully pinned at the vitest
seam) · time budget 20m · tool budget ~15 calls · evidence boundary: vitest seam
only — no Docker, no network; the actual cp behavior is controller-verified dist
evidence, not re-proven here · fixed point: `a3f5b41` (typecheck 0, 102 tests).
Intended candidate: 4 files (`src/loop.ts`, `src/loop.test.ts`, `src/attachments.ts`
comment, `src/attachments.test.ts` test name), one commit. RED = re-pinned
`copyToWorktree` expectations fail on current code (incl. a new multi-attachment
single-entry pin); GREEN = `[".loop-harness"]` passed through. Full mini review
cycle (spec then quality) on the resulting candidate identity.

**T2c checkpoint.** Candidate `898e7e3` (leaf, ~15 tool calls, no deviations).
RED: 2 tests failed on the re-pinned `copyToWorktree` expectations (per-file list
received). GREEN (controller re-verified fresh): focused 55/55, `npm test` 103/103,
typecheck 0. Reviews (sequential, identity `898e7e3`):
- Specification review: **PASS**, zero blocking — FR-003 in-sandbox path preserved
  by the directory copy, nothing-staged → nothing copied still pinned, gate/degrade
  untouched, scope exactly the 4 authorized files.
- Code-quality review: **APPROVED**, zero critical/important. Directed scrutiny
  confirmed: `cp -R` claim re-verified against dist + empirical probes (nested
  paths fail; top-level dir lands correctly); Sandcastle worktrees live under
  `.sandcastle/worktrees/`, NOT inside `.loop-harness` — no recursion/quadratic-copy
  hazard; copy bounded (fresh pruned worktree per run).
- Checkpoint accepted 2026-09-17 on `898e7e3`.

**T2c follow-up queue (all minor, recorded by the quality review).**
1. Multi-attachment test doesn't pin its plural premise — `["​.loop-harness"]` is
   true for ≥1 attachment; add `toHaveBeenCalledTimes(2)` + both-URLs assertion or
   on-disk check for both staged files. Fold into whichever task next touches
   `src/loop.test.ts` attachment tests.
2. `cp -R` existing-dest nesting (`<wt>/.loop-harness/.loop-harness`) is
   unreachable today (onboarding never commits `.loop-harness`; fix branches are
   re-forked from main) — one comment sentence at `src/loop.ts:360` should own the
   assumption. Same fold-in opportunity.
3. `.loop-harness` literal hardcoded in ≥4 places (`src/attachments.ts:130`,
   `src/loop.ts:367`, `src/loop.ts:683`, `src/loop.ts:217`) — extract a
   `LOOP_HARNESS_DIR` constant opportunistically.
4. (spec review) `.loop-harness/profile.json` rides the directory copy and is
   prompt-only defended (no secrets in it today); a future `.loop-harness/.gitignore`
   would mechanically ignore the whole dir on both sides. Also: one issue's
   worktree receives other issues' staged bytes from the same repoDir (same repo,
   same clearance, gitignored) — note in T6 evidence.

## Task 3 — T3: Spec-doc normalizer (FR-005)

**Dispatch record.** Size S-M (2 files, additive to `src/issues.ts`) · risk low
(new pure functions; no loop/queue wiring until T5) · time budget 30m · tool
budget ~15 calls · evidence boundary: vitest unit seam only — no file I/O, no
Docker, no CLI · fixed point: `6be392a` (typecheck 0, 103 tests). Intended
candidate: `src/issues.ts` + `src/issues.test.ts` (`slugify`, `SpecDocParseError`,
`parseSpecDoc`), one commit. Brief = plan Task 3 verbatim plus
style/type-alignment instructions (`NormalizedIssue` shape, title-prefix parity
with `normalizeGitHubIssue` at `src/issues.ts:39`).

**Candidate identity.** `352cbb9` — leaf's two files, no controller amendments.
One RED-to-GREEN iteration inside the leaf (body slice began with the heading's
trailing newline → double blank line vs the GitHub shape; fixed by `.trim()` on
the sliced body — edges only, interior verbatim, pinned by exact-equality tests).

**TDD evidence.** RED: 5 new cases failed on missing exports (not assertion
logic). GREEN: focused 8/8; controller re-verified fresh: typecheck 0,
`npm test` 108/108 (103 + 5).

**Reviews (sequential, identity `352cbb9`).**
- Specification review: **PASS**, zero blocking — shape parity verified
  field-by-field against a live `normalizeGitHubIssue` entry (incl. `url` key
  absence via `in` checks); `###`-only non-match verified empirically; collision
  counter extends mechanically to `-3`; scope purely additive.
- Code-quality review: **APPROVED**, zero critical/important. Test strength
  confirmed (no wrong-reason greens; property-omission pinned via `in`);
  `matchAll` stateless per call; `.trim()` honestly exercised. Three minors →
  follow-up queue.

**Checkpoint accepted** — both sequential reviews on identity `352cbb9`
(2026-09-17).

**T3 follow-up queue (adjacent, not silent scope).**
1. (spec) Slug/suffix id collision: `## Foo`, `## Foo`, `## Foo 2` → two
   `spec-foo-2` ids. Spec-level gap in FR-005's literal scheme; resolve before
   FR-007 dedup consumes these ids in T5 (grilling note if it matters).
2. (spec) `## ` inside a fenced code block splits sections (regex has no fence
   awareness); plan prescribes the regex, spec non-claims say fences are
   description text — tension recorded.
3. (spec) Non-`log:` preamble before the first `##` is silently dropped (only the
   `log:` preamble ignore is pinned).
4. (spec) All-non-alphanumeric title → empty slug → id `spec-`.
5. (quality, minor) `NormalizedIssue.attachedLog` interface doc still says
   "largest fenced block" — true only for github issues now. One-line fix folded
   into T4's brief (same file).
6. (quality, minor) `log:` regex `\s*` spans newlines (path on next line binds)
   and first-wins silently across multiple `log:` lines — benign; either document
   "first `log:` line wins" + pin, or tighten to same-line.
7. (quality, minor) Dead `??` fallbacks at `src/issues.ts:78,81` and
   unnecessary `as const` at line 94 — cosmetic.
8. (quality) `slugify` JSDoc should state ASCII-only + may-return-empty before
   T4 feeds it arbitrary user lines (both feed recorded gaps 1/4).
