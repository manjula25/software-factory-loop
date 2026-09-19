# WI-9 Run 2 — end-states read back fresh (FR-002/FR-003)

2026-09-19. Primary artifact: `run2.log` (verbatim tee of the live run,
exit 0, process exited 15:17:13 local). Operational note: the controller
session restarted mid-run; the run process itself was unaffected (survived
detached, completed normally) — the controller re-established a wait on its
exit and observed the completion. No run behavior was touched.

## Command

`npm run loop -- --repo /home/bitcot/Documents/projects/loop-fixtures-py
--provider claude-via-proxy --model glm-5.2` (no `--triage` — single eligible).

## What the run did (from the log)

- No triage pass (single eligible issue — confirmed: no `loop/triage` lines).
- gh-23 admitted — the issue run 1 deferred for file overlap, now admitted
  with its blocker's fix already on `main` (**re-admission proof**, design
  decision (b)).
- Fix run on `fix/gh-23` → branch pushed → pre-merge diff review →
  squash-merge → canary → `✓ Closed issue #23`.
- Summary: `attempted: 1 (fixed: 1, failed: 0) | skipped-duplicate: 0 |
  skipped-merged: 0 | not-admitted: 0`.
- `MERGED gh-23: https://github.com/manjula25/loop-fixtures-py/pull/25 @
  b46c9efabc448a3636c956a087f99ab013b53b20 (canary: green)`

## End-states read back fresh via gh (not from the log)

- Issue #22: **CLOSED**. Issue #23: **CLOSED**. (Both seeded issues now
  closed by the harness's own chain.)
- PR #25: **MERGED** at 2026-09-19T09:45:39Z; body carries verbatim RED
  (`1 failed, 1 passed` — born-red), GREEN (`2 passed`), symptom mapping,
  independent fresh-sandbox verification, and the opt-in merge statement.
- `origin/main`: `b46c9ef fix(mean): use true division instead of floor
  division (gh-23) (#25)` on `5f372b6 fix(clamp)… (#24)` on the seed
  `88a18c3` — both squash merges stacked.
- Branches: no `fix/gh-22`, `fix/gh-23`, or `loop/*` branches remain on
  origin.

## Spend ledger (final)

| Invocation | Trigger | Count |
|---|---|---|
| Agent probe (T1) | environment precondition | 1 |
| Triage pass | run 1 (2 eligible > 1) | 1 |
| Fix run gh-22 | run 1 | 1 |
| Fix run gh-23 | run 2 | 1 |

**Total: 2 fix runs + 1 triage pass + 1 probe — exactly FR-003's plan. Zero
retries; zero unaccounted invocations.** No harness defects surfaced (Task 5
never triggered; FR-004's "none remain unrecorded" holds vacuously).
