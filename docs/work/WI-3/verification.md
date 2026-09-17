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
