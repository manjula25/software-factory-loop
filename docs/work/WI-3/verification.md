# WI-3 Verification

Evidence appended per accepted checkpoint by the `implement` controller. Each entry
names the candidate identity the evidence applies to.

## Task 1 (T1) — attachment discovery + confidentiality gate — candidate `bfde1f5`

- Baseline (worktree creation, `bacb85a`): `npm run typecheck` exit 0; `npm test`
  8 files / 72 tests passed.
- RED (leaf implementer, preserved in report): new suites failed on module absence —
  `Cannot find module './attachments.js'`, `Cannot find module './onboard-profile.js'`.
- Focused GREEN at candidate: `npx vitest run src/attachments.test.ts
  src/onboard-profile.test.ts` → 15 passed; `npm run typecheck` exit 0; `npm test`
  10 files / 87 tests passed (72 baseline + 15 new).
- Specification review (read-only leaf): **PASS**, zero blocking.
- Code-quality review (read-only leaf): **APPROVED**, zero critical/important; fresh
  re-run of both commands green.
- Both verdicts apply to `bfde1f5`; checkpoint accepted 2026-09-17.
- Non-claims: `scripts/onboard.ts` not executed end-to-end (Docker) in this slice;
  gate not yet wired into the run path (Task 2); live attachment fetch (Task 6).

## Task 2 (T2) — attachment fetch, delivery, loud degrade — candidate `e5523d9`

- Baseline at `2f740b7` (T1 accepted): typecheck 0; 87 tests green.
- RED (leaf, preserved in report): exactly the 12 new cases failed (39 pre-existing
  passed) — `npx vitest run src/attachments.test.ts src/loop.test.ts`.
- Focused GREEN at candidate: same command 51/51; `npm run typecheck` exit 0;
  `npm test` 10 files / 99 tests.
- Specification review: **PASS**, zero blocking (adjacent: excerpt overlap 21–40
  lines; trailing-newline count; extension-less basenames; lossy excerpt decode).
- Code-quality review: **APPROVED**, zero critical (important adjacent: attachment
  bytes could ride the PR via "commit everything" → queued T2b; `new URL` outside try
  → queued T2b). Fresh re-run of both commands green by the reviewer.
- Both verdicts apply to `e5523d9`; checkpoint accepted 2026-09-17.
- Non-claims: no live fetch, no Docker, no CLI (Task 6); real-fetch 3xx inertness is
  reasoned (native follow), not executed.

## T2b — confidentiality guardrail — candidate `d230413`

- Baseline at `733303c` (T2 accepted): typecheck 0; 99 tests green.
- RED (leaf, preserved): exactly the 3 new cases failed (ENOENT on .gitignore,
  malformed-URL throw, prompt still "Commit everything").
- Focused GREEN at candidate: 54/54 targeted; typecheck 0; `npm test` 102/102.
- Specification review: **PASS**, zero blocking (adjacent: `git add -f` bypass with
  prompt as paired defense — accepted; no `!.gitignore` negation — intended).
- Code-quality review: **APPROVED**, zero critical; one important adjacent finding
  (the .gitignore never reaches the fix worktree — copyToWorktree lists explicit
  stagedPaths only) and one unverified runtime concern: Sandcastle's copyToWorktree
  `cp -R` creates no dest parents → nested stagedPaths may fail the fix run.
  Controller verified the cp claim against the pinned dist and confirmed it real.
  Both folded into **T2c** (see implementation notes).
- Both verdicts apply to `d230413`; checkpoint accepted 2026-09-17.
- Non-claims: git-level ignore effect not exercised live (content pinned exactly);
  end-to-end "log stays out of a real PR" evidence belongs to T6.

## T2c — directory-level sandbox delivery — candidate `898e7e3`

- Baseline at `a3f5b41` (T2b accepted): typecheck 0; 102 tests green.
- RED (leaf, preserved): the 2 re-pinned `copyToWorktree` expectations failed
  (code still passed per-file nested stagedPaths).
- Focused GREEN at candidate (controller re-verified fresh): 55/55 targeted;
  typecheck 0; `npm test` 103/103 (102 + 1 new multi-attachment single-entry pin).
- Specification review: **PASS**, zero blocking (adjacent: profile.json
  prompt-only defense; cross-issue staged bytes in one worktree — both queued).
- Code-quality review: **APPROVED**, zero critical/important; three minor
  follow-ups (plural-premise assertion; existing-dest cp comment; `.loop-harness`
  literal constant). Reviewer re-verified the cp -R semantics empirically and
  confirmed Sandcastle worktrees live under `.sandcastle/` — no copy recursion.
- Both verdicts apply to `898e7e3`; checkpoint accepted 2026-09-17.
- Non-claims: no Docker/live copy executed here — the cp behavior is dist-verified
  plus host-probed; live end-to-end delivery evidence belongs to T6.

## Task 3 (T3) — spec-doc normalizer — candidate `352cbb9`

- Baseline at `6be392a` (T2c accepted): typecheck 0; 103 tests green.
- RED (leaf, preserved): 5 new cases failed on missing exports (`parseSpecDoc`
  not a function; `slugify`/`SpecDocParseError` undefined) — not assertion logic.
- Focused GREEN at candidate (controller re-verified fresh): 8/8 in
  `src/issues.test.ts`; typecheck 0; `npm test` 10 files / 108 tests.
- Specification review: **PASS**, zero blocking (adjacent: slug/suffix id
  collision; `## ` in fences; preamble dropped; empty-slug edge — queued).
- Code-quality review: **APPROVED**, zero critical/important (three minors:
  stale `attachedLog` interface doc — folded into T4; lax `log:` regex docs;
  dead `??` fallbacks / `as const` — queued).
- Both verdicts apply to `352cbb9`; checkpoint accepted 2026-09-17.
- Non-claims: `parseSpecDoc` not yet wired into any source-selection path
  (Task 5); no file I/O (takes text; reading is T5's job); no Docker.

## Task 4 (T4) — plain-list normalizer — candidate `edbe2cb`

- Baseline at `e5eb378` (T3 accepted): typecheck 0; 108 tests green.
- RED (leaf, preserved): 5 new cases failed on missing exports
  (`parsePlainList` not a function; `PlainListParseError` undefined).
- Focused GREEN at candidate (controller re-verified fresh): 13/13 in
  `src/issues.test.ts`; typecheck 0; `npm test` 10 files / 113 tests.
- Specification review: **PASS**, zero blocking (adjacent: no literal
  cross-normalizer comparison — defensible, vacuous for plain lists;
  multi-word suffix fallthrough; empty-slug ids; guard position).
- Code-quality review: **APPROVED**, zero critical/important (four minors:
  delimiter-spacing asymmetry; error-class JSDoc; slug/suffix ambiguity
  advisory for T5; test-name nit — queued).
- Both verdicts apply to `edbe2cb`; checkpoint accepted 2026-09-17.
- Non-claims: `parsePlainList` not yet wired into any source-selection path
  (Task 5); no file I/O; no Docker.

## Task 5 (T5) — source selection + queue parity — candidate `322bc00`

- Baseline at `25c3ce8` (T4 accepted): typecheck 0; 113 tests green.
- RED (leaf, preserved): 8 failed on missing exports/behavior; 2 passed
  immediately as expected (queue parity pin against untouched `src/queue.ts`;
  GitHub-default guard).
- Focused GREEN at candidate (controller re-verified fresh): 63/63 across
  `src/loop.test.ts` + `src/queue.test.ts`; typecheck 0; `npm test` 124/124.
- Specification review: **PASS**, zero blocking (adjacent: `--`-path rejection;
  repeated-flag first-wins; T6 owns pipeline evidence).
- Code-quality review: **APPROVED**, zero critical/important (four minors:
  `--issue`+source and `--label`+source silent-ignore → promoted to T5b;
  no-op `!` assertion; CLI-reachable parse-error message note — queued).
- Both verdicts apply to `322bc00`; checkpoint accepted 2026-09-17.
- Non-claims: no live CLI execution, no Docker, no real file reads beyond test
  fixtures; `--issue`/`--label` combination handling deferred to T5b.

## T5b — reject `--issue`/`--label` + source flag — candidate `c12749e`

- Baseline at `cc95f83` (T5 accepted): typecheck 0; 124 tests green.
- RED (leaf, preserved): the 2 new combination tests failed (the `--label` one
  via the silent-ignore fallthrough — ENOENT on the never-read file).
- Focused GREEN at candidate (controller re-verified fresh): 45/45 in
  `src/loop.test.ts`; typecheck 0; `npm test` 10 files / 126 tests.
- Leaf also verified a realistic full-argv CLI invocation
  (`--repo … --spec-doc a.md --issue 3 --provider …`) exits with the
  SourceSelectionError.
- Specification review: **PASS**, zero blocking. Code-quality review:
  **APPROVED**, zero findings at every severity.
- Both verdicts apply to `c12749e`; checkpoint accepted 2026-09-17.
- Non-claims: error-precedence when `--repo` is also missing (pre-existing
  ordering, out of scope).

## Task 6 (T6) — live evidence runs — candidate `080b90f`

- Baseline at `ec3e7f0` (T5b accepted): typecheck 0; 126 tests green.
- Step 1 gate refusal (FR-002): PASS — exact ConfidentialityGateError message,
  exit 1, zero spend, no fetch, no sandbox. Log preserved verbatim.
- Step 2 live attachment (FR-003): PASS — 384 bytes staged (content never
  recorded), fix commit `6aea681` on `fix/gh-3` with retained regression test,
  PR #12 opened (OPEN, unmerged); PR body free of attachment URL/content.
  One pre-fix abort (zero LLM spend) from a stale profile — remediated via
  harness-prescribed re-onboarding; abort log preserved.
- Step 3 spec-doc end-to-end (FR-008): PASS — `source: spec-doc (...)` in the
  verbatim summary, fixed: 1, PR #13 on `fix/spec-titlecase-…`; PR body clean.
- Specification review: **PASS**, zero blocking (live read-only cross-checks
  of PRs, commit, staged files; deviations recorded honestly).
- Code-quality review: **APPROVED**, zero critical/important (log fidelity
  source-authenticated; confidentiality sweep clean; three wording minors).
- Both verdicts apply to `080b90f`; checkpoint accepted 2026-09-17. A
  post-checkpoint docs-only amendment applied the three wording minors
  (recorded in implementation-notes; covered by the branch-level review gates).
- Non-claims: excerpt-in-prompt is unit-seam evidence + indirect live
  corroboration (correct fix matching the attachment-described symptom);
  `.loop-harness/.loop-harness/` nesting artifact undiagnosed (follow-up
  queued); PRs #12/#13 await human review — the harness never merges.

## WI-3 completion verification — final branch state `da1af05` (2026-09-17)

**Claim under test.** WI-3's eight FRs (attachment fetching FR-001–004,
non-GitHub sources FR-005–008) are implemented and evidenced on branch
`worktree-wi-3`; all nine checkpoints (T1, T2, T2b, T2c, T3, T4, T5, T5b, T6)
passed sequential spec + quality reviews on pinned identities; the branch is
green and clean.

**Fresh proving commands (run 2026-09-17 against exactly `da1af05`).**
- `git rev-parse HEAD` → `da1af05…`; `git status --short` → empty (clean
  tree); branch `worktree-wi-3`.
- `git log --oneline bacb85a..HEAD` → 19 commits: 9 code/evidence checkpoints
  each followed by its evidence commit — every checkpoint's reviewed identity
  is in the chain (bfde1f5, e5523d9, d230413, 898e7e3, 352cbb9, edbe2cb,
  322bc00, c12749e, 080b90f).
- `git diff --name-only bacb85a..HEAD` → 20 files, all accounted for:
  `src/attachments.{ts,test.ts}`, `src/issues.{ts,test.ts}`,
  `src/loop.{ts,test.ts}`, `src/onboard-profile.{ts,test.ts}`,
  `src/queue.test.ts`, `src/sandcastle-adapter.ts`, `scripts/onboard.ts`,
  `CLAUDE.md` (module-table rows, per its same-PR rule), and
  `docs/work/WI-3/*` evidence. Nothing under `.loop-harness/`, no `.env`,
  no stray paths.
- `npm run typecheck` → exit 0.
- `npm test` → 10 files / 126 tests passed, exit 0 (baseline at branch point:
  72 tests — net +54 permanent reproduction/pinning tests).
- `gh pr list --repo manjula25/loop-fixtures-py --state open` → #12
  (`fix/gh-3`) and #13 (`fix/spec-titlecase-…`) both OPEN, `mergedAt: null` —
  external evidence that the never-auto-merge constraint held through the live
  runs.

**Evidence classification.** Unit (vitest, 126 tests) + runtime (three live
Docker runs in T6, logs preserved) + external read-only (PR states, re-checked
fresh above) + human (pending: review/merge of PRs #12/#13 — outside harness
authority by design).

**Prior unknowns — reconciliation.**
- CLOSED: copyToWorktree nested-path failure (T2c: dist-verified, fixed,
  live-run corroborated); staging `.gitignore` never reaching the worktree
  (T2c directory copy — live run clean); attachment bytes riding the PR (T2b
  guardrail + T6 live PR-body greps = 0 matches on both PRs).
- DEFERRED with effect and owner (all recorded in implementation-notes
  follow-up queues): `.loop-harness/.loop-harness/` worktree artifact —
  harmless untracked-dir warning, owner: `diagnosing-bugs` pass before the
  next live-run milestone; slug/suffix id collision (`spec-foo-2` ambiguity)
  — owner: grilling before FR-007 dedup is relied on across sources;
  delimiter-spacing asymmetry, excerpt overlap 21–40 lines, trailing-newline
  count, extension-less basenames, empty-slug ids — cosmetic/in-contract,
  owner: recorded follow-ups.

**Remaining risks.** None material to the claim. The two open fixtures PRs
(#12/#13) fix the same bug from two sources — a human must merge one and
close the other; until then the fixtures repo carries a duplicate fix.

**Non-claims.** No live run against any client repo (fixtures are synthetic,
operator-owned); no plain-list live run (FR-006 is unit-pinned; its selection
path is identical to the spec-doc path live-proven in T6); no measurement of
provider cost in currency (run counts only); excerpt-in-prompt verified at the
unit seam, not from live prompt capture (prompt content is never recorded by
design).

## Task 7 (T7) — code-review blocking fixes — candidate `01b2b04`

- Baseline at `55657c4` (review record committed; code state identical to
  `a604ffd`): typecheck 0; 126 tests green.
- RED (leaf, preserved in report): gate-bypass test failed by sailing through
  (full spend, no refusal); cleared-fetch test failed with `fetch` at 0 calls;
  GitHub PIN green immediately as designed.
- Focused GREEN at candidate (controller re-verified fresh):
  `npx vitest run src/loop.test.ts` → 48/48; `npm run typecheck` exit 0;
  `npm test` 10 files / 129 tests (126 + 3).
- Specification review: **PASS**, zero blocking (adjacent: two comment-rationale
  inaccuracies, queued; GitHub-fence URL seam noted as pre-existing).
- Code-quality review: **APPROVED**, zero critical/important; reviewer re-ran
  all three commands fresh and green.
- Both verdicts apply to `01b2b04`; checkpoint accepted 2026-09-17.
- Non-claims: no live plain-list run with a suffix URL (unit-pinned at the
  outcome/spend seam; the gate and fetch paths are the same ones live-proven
  in T6 for description URLs).

## WI-3 completion verification — amendment for T7, final branch state `01b2b04` (2026-09-17)

The completion verification above was recorded against `da1af05`. Since then
the branch gained: the two-axis code-review record (`55657c4`,
`docs/work/WI-3/review.md` — 2 blocking findings) and the T7 fix (`01b2b04`)
resolving both. Proving commands re-run fresh against exactly `01b2b04`:

- `git rev-parse HEAD` → `01b2b04…`; `git status --short` → empty (clean tree).
- `git log --oneline bacb85a..HEAD` → 22 commits; every checkpoint identity in
  the chain (…, `080b90f`) plus `55657c4` and `01b2b04`.
- `npm run typecheck` → exit 0.
- `npm test` → 10 files / 129 tests passed, exit 0.
- Blocking finding 1 (plain-list gate bypass): CLOSED — spec + quality reviews
  on `01b2b04`; uncleared+suffix-URL refusal and cleared+suffix-URL fetch both
  pinned at the spend seam.
- Blocking finding 2 (workflow.md command list): CLOSED — source flags and
  exclusivity rules documented in the same PR (`01b2b04`), traced accurate
  against `parseSourceArgs` by the spec review.
- `gh pr list --repo manjula25/loop-fixtures-py --state open` → #12 and #13
  both OPEN, `mergedAt: null` — never-auto-merge still holds.

All prior non-claims and deferred follow-ups stand unchanged; two new minor
follow-ups recorded in implementation-notes (comment-rationale wording,
PIN prefix convention).
