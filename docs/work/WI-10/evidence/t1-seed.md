# WI-10 Task 1 — seed evidence (FR-001)

Controller-executed 2026-09-19, worktree `.claude/worktrees/wi-10`
(branch `worktree-wi-10`, base local `main` @ `9fc072b`, fast-forwarded
from `origin/main` `93ec308`).

## Environment preconditions

- Harness baseline in the worktree: `npm run typecheck` exit 0; `npm test`
  10 files / 216 tests exit 0. `.env` copied (untracked, never echoed).
- `npm run build:image` — build complete; `npm run smoke:image` — **9/9
  ok**; `npx tsx scripts/probe-agent.ts glm-5.2` — stdout `OK`, exit 0
  (one benign `unrecognized_model` stderr notice). **Ledger: 1 probe.**

## Seed (fixtures repo `manjula25/loop-fixtures-py`, zero LLM)

- Commit `afcee4a` `seed(moneyops): add to_cents helper` pushed to
  fixtures `main` (`b46c9ef..afcee4a`). File: `src/loopfix/moneyops.py` —
  exactly the plan's pinned seed code (`int(amount)` truncates instead of
  converting to cents).
- Fresh clone at `afcee4a`, suite inside the committed `sandcastle-loop`
  image: **23 passed** — green; dormant confirmed (no test touches
  moneyops).
- Hand-check of the defect (in the image): `to_cents(1.50)` → `1`
  (expected `150`).
- Preflight: `recorded baseline: [] / fresh run found: [] / MATCH`,
  preflight branch deleted, exit 0.

## Issue filed (actuals; plan expected #24 — #24/#25 were taken by WI-9's
## PRs, so the actual is #26)

- **#26** `to_cents: dollar amounts truncated to whole dollars instead of
  cents` — clean WI-1 style: symptom, expected (docstring examples),
  minimal repro.
  https://github.com/manjula25/loop-fixtures-py/issues/26
- Verified the ONLY open issue (`gh issue list --state open` → exactly
  #26) — the run's entire eligible queue.

## Conflicting test prepared (NOT pushed)

- Branch `wi10-conflict` (local to `/tmp/wi10-lfclone`) @ `461a13f`
  `test(moneyops): pin whole-dollar truncation contract` on top of the
  seed: `tests/test_moneyops_contract.py` — exactly the plan's pinned
  code (two tests asserting whole-dollar truncation: `to_cents(19.99) ==
  19`, `to_cents(2.0) == 2`).
- Suite inside the image on this branch tree: **25 passed** (23 + 2 — both
  contract tests pass against the buggy code; both fail against a correct
  fix).
- Absent from origin (branch never pushed). Push happens only at the
  timed moment in Task 2.

## Deviations from plan

- Issue number #26 (plan expected #24; actuals recorded per plan).
- The seed-check clone needed `.loop-harness/profile.json` copied in
  before preflight — the profile is deliberately untracked/gitignored in
  the fixtures repo (onboarding config), so no clone carries it. Same
  class of evidence; matches how the loop itself operates (repoDir carries
  the profile).
- The first push attempt was refused (the temp clone's origin initially
  pointed at the local fixtures path, and the local path push hit
  `receive.denyCurrentBranch`); fixed by pointing the clone's origin at
  `git@github.com:manjula25/loop-fixtures-py.git`. No repo state was
  touched by the refused push.
