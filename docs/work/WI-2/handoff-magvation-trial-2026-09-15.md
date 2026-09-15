# Handoff — WI-2 real-project trial (magvation), 2026-09-15 (final)

Purpose: continue the software-factory-loop POC trial against the magvation repo on another
machine. Onboarding on the original machine SUCCEEDED (pass 3) after two failed attempts;
the loop itself has not been started.

## Goal
Run the WI-2 queue loop (acquire issues → dedup → capped admission → sequential Sandcastle
fix runs → fresh-sandbox verification → PRs) for real against
`manjula25/magvation-hayapp-backend-internal`, using its three open issues (#1, #2, #3).

## Repositories and identity
| What | Where | State |
|---|---|---|
| Harness repo | `manjula25/software-factory-loop` | PR #4 (WI-2) OPEN vs `main` |
| Harness worktree | `.claude/worktrees/wi-2`, branch `worktree-wi-2` | HEAD `3290e2d`; commits `e7560d0` (onboard `--install`/`--test` flags) and `3290e2d` (`--single-test` flag) are **local-only, not pushed** — PR #4 does not contain them |
| Target repo | clone of the fork | `origin` = manjula25 fork (PRs land here only), `upstream` = bitcot original; `main` at `d298a1a` |
| Target issues | fork issues #1 (camera json overwrite), #2 (stale parlay pin), #3 (trial artifacts pollute git status) | all OPEN |
| Onboarded profile | `.loop-harness/profile.json` inside the target clone (untracked, machine-local) | written on the original Mac; recreate on the new machine by re-running onboarding |

## Constraints (all still binding)
No auto-merge; never trust the agent's completion signal (fresh-sandbox re-verification);
confidentiality gate — **cleared for CareSync and magvation only** (both 2026-09-15), any
other client repo needs its own confirmation; reproduction tests are permanent artifacts;
budget cap per run; local Docker only; env values never echoed into prompts/PR bodies/logs;
never repo-wide git commands from `~`; PRs only on the manjula25 fork, never bitcot repos.

## Established facts (verified — do not re-derive)
1. **Parlay is not needed.** `main` is the synapse rewrite: zero `import parlay` in code or
   tests; the `parlay @ git+ssh://bitbucket.org/...` requirements line is stale. Bitbucket
   SSH access is NOT needed for this trial.
2. **Windows-only pins** (`pywin32`, `pywin32-ctypes`, `wmi`) must be filtered out on
   Linux/macOS; all their imports are platform-guarded.
3. **macOS-native baseline:** 166 failed / 3686 passed / 15 skipped, ~27 min (Python 3.12).
4. **Docker sandbox needs `keyrings.alt`** — `config_manager.py` reads the OS keyring at
   import time; in a bare container collection dies with `NoKeyringError` (pass 1 produced a
   false baseline: 103 whole-file ERRORs, exit 2, ~2 min).
5. **Docker pass 2 hung** (pytest 0% CPU ~1 h). Pass 3 fixed this with `pytest-timeout`:
   hangs become recorded failures, bounded at 180 s each.
6. **Docker pass 3 SUCCEEDED:** suite exit 1, born-red profile with **890 test-level
   failure entries** (some duplicated in the list — harmless, membership checks only),
   `expectedDurationSec` ≈ 1980 (~33 min). The Docker failure set is much larger than the
   macOS-native 166 — environmental (file-based keyring, slower I/O, timeouts). That is
   fine for the loop: what matters is that preflight compares Docker-fresh against
   Docker-recorded, and fixes must add no NEW failures beyond that baseline.

## Exact commands (proven, in order)
Onboard (from the harness worktree root):
```
npx tsx scripts/onboard.ts /path/to/magvation-clone \
  --install "sed -e '/^parlay @/d' -e '/^pywin32/d' -e '/^wmi==/d' requirements.txt > /tmp/req-trial.txt && pip install -r /tmp/req-trial.txt pytest pytest-asyncio pytest-timeout keyrings.alt" \
  --test "pytest -q --timeout=180" \
  --single-test "pytest -q --timeout=180 {test}"
```
Loop (queue default, cap 3, all three issues):
```
npm run loop -- --repo /path/to/magvation-clone --provider claude-via-proxy
```
Sandbox image: `sandcastle-loop` via `npx sandcastle docker build-image` (python 3.12,
pytest 9.1.1, node, git, gh, agent CLIs, non-root `agent` user). Provider config: the
harness repo's `.env` (claude-via-proxy).

## Remaining steps, in order
1. On the new machine: clone `manjula25/software-factory-loop`, check out `worktree-wi-2`,
   re-add the two onboard flag commits if absent (small: `--install`/`--test`/`--single-test`
   overrides in `scripts/onboard.ts`, defaults unchanged), build `sandcastle-loop`, configure
   `.env`.
2. Clone the fork `manjula25/magvation-hayapp-backend-internal` (`main`, `d298a1a`).
3. Run onboarding (above) — expect ~35 min and a Docker baseline of roughly 800–900
   failures; entries must be `tests/...::test_name` shaped, never whole files.
4. Run the loop (above). Multi-hour run: each suite ~30 min in Docker; three issues ×
   (preflight + fix + verify). `--max-issues 1` is the approved smoke-first option.
5. Watch for: profile-staleness aborts (harness-level failure; a mismatch between Docker
   runs means nondeterminism — investigate before re-running) and Docker-hanging tests
   (bounded to 180 s each).

## Environment note (original Mac)
Its disk hit ENOSPC around the handoff; pass 3 still completed, but free space before any
further Docker work there (`docker system prune`, check Docker VM disk size). The two
harness commits `e7560d0`/`3290e2d` remain unpushed on that machine.

## Suggested skills / first action
First action: step 1. Then `verification-before-completion` after the trial run to record
evidence in `docs/work/`. Authoritative docs: `harness-prd-v2.md`, `docs/agents/workflow.md`,
`docs/work/WI-2/`.
