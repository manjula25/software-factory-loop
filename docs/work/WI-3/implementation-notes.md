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

**T2b follow-up (proposed, owner decision pending).** One small commit-cycle task:
tighten the fix-prompt commit instruction to name `.loop-harness/` as never-committed,
move `new URL` inside the try, and write a `.loop-harness/attachments/.gitignore`
(`*`) at staging time. Full mini review cycle (spec + quality) on its own candidate.
