# WI-2 magvation real-project trial — evidence record (2026-09-16)

The trial the 2026-09-15 handoff (`handoff-magvation-trial-2026-09-15.md`) set up, executed on
a second machine (the original Mac had hit ENOSPC / CPU limits). This record is evidence of the
**trial run**, not a new verification of WI-2's code — that remains `verification.md`. The two
onboard flag commits the handoff flagged as unpushed (`e7560d0`, `3290e2d`) are in this branch's
history (HEAD `f30c745` on `worktree-wi-2-trial`, tracking `origin/worktree-wi-2` after the
handoff commit `f30c745` was pushed).

## The claim, stated exactly

On branch `worktree-wi-2-trial` @ `f30c745`, the WI-2 queue loop processed all three open
issues of `manjula25/magvation-hayapp-backend-internal` (target `main` @ `d298a1a`) — a smoke
run (`--max-issues 1`, gh-1) and a queue run (default cap 3, gh-2 + gh-3) — each issue through
dedup/admission, preflight, Sandcastle fix, fresh-sandbox verification, and a PR opened on the
fork. PRs #4, #5, #6 are open, unmerged, and carry the expected shape (production fix +
permanent regression test under `tests/fixed-issues/`).

## Environment (second machine)

Linux, 8 CPU, 15 GB RAM, 142 GB free, Docker 29.6.2. `sandcastle-loop` image built fresh via
`npm run build:image`; all 9 `smoke:image` checks passed (python, pytest, node, git, gh,
claude, codex, opencode, non-root `agent` user). Provider: `claude-via-proxy` via the harness
`.env`.

Two machine-setup gaps not anticipated by the handoff, both fixed locally (no code change):

1. `gh repo clone` of a fork auto-adds `upstream`, and the harness derives the issue tracker
   from `gh repo view`, which resolves to **upstream** (`bitcot/…` — issues disabled). Symptom:
   `QueueAcquisitionError: … repository has disabled issues`. Fix: `gh repo set-default
   manjula25/magvation-hayapp-backend-internal` inside the clone. PR pushes were already
   pinned to `origin` (the fork), so nothing else moved.
2. Plain `git` had no GitHub credentials (queue dedup runs `git ls-remote origin`). Symptom:
   `fatal: could not read Username for 'https://github.com'`. Fix: `gh auth setup-git`.

## Onboarding (fresh on this machine, as the handoff required)

Command: the handoff's proven onboard line (parlay + Windows pins filtered, `keyrings.alt`,
`--timeout=180`). Result, exit 0:

- Born-red profile at `.loop-harness/profile.json` in the target clone: **168 test-level
  failure entries, zero whole-file entries** (`tests/…::test_name` shaped throughout).
- `expectedDurationSec` ≈ **386** (~6.4 min/suite) vs ~1980 on the Mac — this machine is
  ~5× faster, so the Docker baseline (168) sits near the macOS-native count (166) rather than
  the Mac's Docker count (890, mostly timeout-induced). Consistent with the handoff's framing:
  preflight compares Docker-fresh against Docker-recorded **on the same machine**; only
  *new* failures beyond the machine's own baseline matter.

## Runs

### Smoke run — `--max-issues 1` (15:52–16:19, ~27 min)

`evidence/magvation-run-smoke-gh-1.log`. Preflight (~6.5 min) → fix agent on `fix/gh-1`
(~12 min) → fresh-sandbox verification (~7 min) → PR.

```
Run summary — attempted: 1 (fixed: 1, failed: 0) | skipped-duplicate: 0 | not-admitted: 2
PR: https://github.com/manjula25/magvation-hayapp-backend-internal/pull/4
NOT ADMITTED gh-2: cap
NOT ADMITTED gh-3: cap
```

### Queue run — default cap (17:39–18:49, ~70 min)

`evidence/magvation-run-queue-gh2-gh3.log`. gh-2 fix phase ~27 min (dependency issue; the
agent ran its own full-suite passes while iterating), then verification; gh-3 similarly.

```
Run summary — attempted: 2 (fixed: 2, failed: 0) | skipped-duplicate: 1 | not-admitted: 0
PR: https://github.com/manjula25/magvation-hayapp-backend-internal/pull/5
PR: https://github.com/manjula25/magvation-hayapp-backend-internal/pull/6
```

`skipped-duplicate: 1` is gh-1 — dedup correctly refused to re-fix it because PR #4 was open.

### Anomaly observed, resolved, and explained

After gh-3, the harness warned: worktree `fix/gh-3` had uncommitted changes. Inspection
showed exactly `M vir/win-x64/out_camera_data.json` — the gh-1 file. The gh-3 branch is based
on `main`, which does not yet contain the gh-1 fix (PR #4 unmerged), so running the suite
during verification re-overwrote the tracked file. Benign verification residue, not fix
content: PR #6 commits only `.gitignore` + the regression test. All loop worktrees were then
removed (`git worktree remove --force`) so future runs start clean.

## Fresh proving checks (2026-09-16, 18:52–18:53)

### External (fork, via gh) — exit 0

| PR | state | head → base | files |
|---|---|---|---|
| #4 | OPEN, `mergedAt: null` | `fix/gh-1` → `main` | `hayapp_python/synapse/adapters/camera_adapter.py`, `tests/fixed-issues/test_gh_1.py` (+82/−2) |
| #5 | OPEN, `mergedAt: null` | `fix/gh-2` → `main` | `requirements.in`, `requirements.txt`, `tests/fixed-issues/test_gh_2.py` (+189/−124) |
| #6 | OPEN, `mergedAt: null` | `fix/gh-3` → `main` | `.gitignore`, `tests/fixed-issues/test_gh_3.py` (+100/−0) |

All three fork issues remain open (3 open) — nothing was auto-closed or auto-merged.

### Harness at this commit — fresh, exit 0

- `npm test`: 8 files, **72/72 passed**, exit 0.
- `npm run typecheck`: clean, exit 0.

## Evidence boundaries and non-claims

- The per-issue "fixed" verdicts are the **harness's own fresh-sandbox verification runs**
  during the trial (reproduction test + full suite against the recorded baseline). I did not
  independently re-execute the target suites after the PRs were opened; that evidence lives
  in the run logs and the harness's verification gate, not in this record.
- **PR content is unreviewed by a human.** The trial proves the loop's mechanics against a
  real repo, not that the three fixes are the right root-cause fixes — that is the PR
  reviewers' call. No merge has happened and none is proposed here.
- No profile-staleness abort and no Docker-hung test occurred in any run (0 failed), so those
  two handoff watch-items remain unexercised on this machine.
- Baseline asymmetry note: this machine's 168-failure baseline differs from the Mac's 890;
  the two profiles are not comparable across machines and were never compared by the harness.
