# WI-9 Run 1 — end-states read back fresh (FR-002/FR-003)

2026-09-19, after the run completed (exit 0). Primary artifact:
`run1.log` (33 lines, verbatim tee of the live run).

## Command

`npm run loop -- --repo /home/bitcot/Documents/projects/loop-fixtures-py
--provider claude-via-proxy --model glm-5.2 --triage`

(from worktree `.claude/worktrees/wi-9` @ `64e882c`, image `sandcastle-loop`
built and smoked 9/9 this session.)

## What the run did (from the log)

- Triage pass on `loop/triage`; raw output (from
  `.sandcastle/logs/loop-triage-triage.log`, schema-valid):
  `{"scores":{"gh-23":3,"gh-22":4},"files":{"gh-23":["src/loopfix/numops.py"],"gh-22":["src/loopfix/numops.py"]}}`
- gh-22 (higher score) admitted → fix run on `fix/gh-22` → branch pushed →
  pre-merge diff-review pass on `loop/review` → squash-merge → canary →
  issue close: `✓ Closed issue #22`.
- Summary line: `attempted: 1 (fixed: 1, failed: 0) | skipped-duplicate: 0 |
  skipped-merged: 0 | not-admitted: 1`.
- `MERGED gh-22: https://github.com/manjula25/loop-fixtures-py/pull/24 @
  5f372b6dbd8577c13199afa581b49645cc85fedc (canary: green)`
- `NOT ADMITTED gh-23: file overlap with gh-22` — the plan-expected deferral.

## End-states read back fresh via gh (not from the log)

- Issue #22: **CLOSED** (`clamp: negative values fall through below lo`).
- Issue #23: **OPEN** (`mean: floor division truncates the average`) — the
  deferred one.
- PR #24: **MERGED** at 2026-09-19T09:34:27Z; body carries verbatim RED
  (`1 failed, 3 passed` — born-red: the reproduction test failed pre-fix),
  GREEN (`4 passed`), symptom mapping, and the independent fresh-sandbox
  verification line.
- `origin/main`: `5f372b6 fix(clamp): apply lower bound so values below lo
  are clamped (gh-22) (#24)` directly on top of the seed `88a18c3`; the
  merge brought `src/loopfix/numops.py` (1 line) + `tests/fixed-issues/
  test_gh_22.py` (23 lines) — one focused fix + the retained repro test
  (constraint 4).
- Branches from this run: `fix/gh-22`, `loop/triage`, `loop/review` — all
  gone from origin. (Older `origin/fix/gh-{1,2,3,10}` remain from prior work
  items — adjacent observation, pre-existing, tolerated by the stale-branch
  pass; recorded, not fixed here.)

## Spend ledger

| Invocation | Trigger | Count |
|---|---|---|
| Agent probe (T1) | environment precondition | 1 |
| Triage pass | run 1, 2 eligible > 1 | 1 |
| Fix run | run 1, gh-22 admitted | 1 |

Running total: 2 fix-path invocations remain within plan (1 fix run for
gh-23 in run 2). No retries; no unaccounted invocations.
