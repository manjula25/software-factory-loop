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
