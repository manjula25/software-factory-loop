# WI-9 Task 1 — seed evidence (FR-001)

Controller-executed 2026-09-19, worktree `.claude/worktrees/wi-9`
(branch `worktree-wi-9`, base local `main` @ `278bbf7`).

## Environment preconditions

- Harness baseline in the worktree: `npm run typecheck` exit 0; `npm test`
  10 files / 216 tests exit 0. `.env` copied (untracked).
- `npm run build:image` — build complete.
- `npm run smoke:image` — **9/9 ok** (git, gh, claude 2.1.270, codex,
  opencode, python, pytest, node, non-root agent user).
- `npx tsx scripts/probe-agent.ts glm-5.2` — stdout `OK`, exit 0 (one benign
  `unrecognized_model` stderr notice; the call succeeded). **Ledger: 1 probe
  call.**

## Seed (fixtures repo `manjula25/loop-fixtures-py`, zero LLM)

- Commit `88a18c3` `seed(numops): add clamp and mean helpers` pushed to its
  `main` (`88984fd..88a18c3`). File: `src/loopfix/numops.py` — exactly the
  plan's pinned seed code (`min(value, hi)` ignores `lo`;
  `sum(values) // len(values)` floor-divides).
- Fresh clone (`git clone` to `/tmp/wi9-lfclone`), suite run inside the
  committed `sandcastle-loop` image (`pip install -e .[test]` then
  `python -m pytest -q`): **17 passed in 0.03s** — green; no tests exist for
  the new helpers (dormant confirmed).
- Hand-check of the defects: `clamp(-5, 0, 10)` → `-5` (expected `0`);
  `mean([1, 2])` → `1` (expected `1.5`).
- Preflight: `npx tsx scripts/preflight-check.ts <fixtures-clone>` —
  `recorded baseline: [] / fresh run found: [] / MATCH — preflight passes`,
  `preflight branch deleted`, exit 0.

## Issues filed (actuals; plan expected #21/#22 — #21 was taken)

- **#22** `clamp: negative values fall through below lo` — clean style:
  symptom, expected-from-docstring, repro snippet.
  https://github.com/manjula25/loop-fixtures-py/issues/22
- **#23** `mean: floor division truncates the average` — messy-log style:
  symptom, expected behavior, and a deliberately noisy inline traceback log
  block (interleaved paths/timestamps) so attachment discovery runs on a
  real issue body.
  https://github.com/manjula25/loop-fixtures-py/issues/23

Both OPEN immediately after filing (`gh issue list --state open` shows exactly
these two) — they are the run's entire eligible queue. Host `python3 -m
pytest` was unavailable (no host pytest); the suite check ran in the sandbox
image instead — same class of evidence, and the image is the environment the
run itself uses.

## Deviations from plan

- Issue numbers #22/#23 (plan said "expected #21/#22; record actuals").
- Seed suite check ran in the fresh clone inside the Docker image rather than
  in the host clone (host lacks pytest) — strictly stronger isolation, same
  expected result (green, unchanged count).
