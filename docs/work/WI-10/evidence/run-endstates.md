# WI-10 Run — end-states read back fresh (FR-002/FR-003)

2026-09-19. Primary artifact: `run.log` (verbatim tee of the live run).
Command: `npm run loop -- --repo
/home/bitcot/Documents/projects/loop-fixtures-py --provider
claude-via-proxy --model glm-5.2 --issue 26` (single-issue mode, decision
(b); no triage — **ledger: 1 probe + 1 fix run, attempt 1 of ≤2**).

## Timing (the manufactured race)

| Event | Wall clock | Evidence |
|---|---|---|
| `[gh-26] Started on branch fix/gh-26` | 16:20:52 | run.log line 7 |
| Unambiguous agent activity (Bash tool calls exploring the repo) | 16:21:48 | fix log >2 KB: `find … moneyops.py`, `ls -la …` |
| **Conflicting test pushed** `wi10-conflict:main` | **16:21:57** | `afcee4a..461a13f`, run.log at 388 bytes |
| Revert pushed | 16:24:33 | run.log line 32–37 |

Rationale: the fix branch's base was pinned when the sandbox cloned
(before "Agent started", 16:20:52); the push at 16:21:57 is strictly after
base-pinning and ~2.5 minutes before the merge — comfortably inside the
window. The staged trigger (wait for real Bash-tool output, not merely log
existence) is what landed attempt 1.

## What the run did (from the log)

- Acquisition refreshed main to the seed (`b46c9ef..afcee4a`).
- Fix run on `fix/gh-26` → branch pushed → pre-merge review on `loop/review`
  → squash merge `7febfdb` onto main (which had advanced to the contract
  test `461a13f`) → canary.
- Canary RED — exactly the two contract tests:
  `tests/test_moneyops_contract.py::test_to_cents_truncates_fractional_dollars`,
  `tests/test_moneyops_contract.py::test_to_cents_whole_dollars`.
- Auto-revert `b113686` pushed; comment posted on PR #27; failure line:
  `⚠️ REVERTED gh-26: merge 7febfdbe4c10d1aa0b5cc637a7753eb7467bd692
  reverted after canary went red — canary new failures vs baseline on
  merged main: …; revert: b113686…; comment: posted; notify: manjula25`.
- No `✓ Closed issue` line (close happens only on a green canary).

## End-states read back fresh via gh/git (not from the log)

- Fixtures `main` history — exactly the plan's four-commit linearity:
  `afcee4a seed` → `461a13f contract` → `7febfdb squash merge (#27)` →
  `b113686 revert`.
- `main` tree: `moneyops.py` restored to the buggy `int(amount)`;
  `tests/test_moneyops_contract.py` PRESENT;
  `tests/fixed-issues/test_gh_26.py` ABSENT (the revert removed it).
- PR #27: **MERGED**, with the comment (read back verbatim, author
  `manjula25`):
  `@manjula25 ⚠️ REVERTED: the merge of this PR (7febfdbe…) was
  automatically reverted. / The post-merge canary suite on main went
  red — canary new failures vs baseline on merged main: …contract tests… /
  Revert commit: b113686b7337a920e27686e770d8defd0782179a. / The run has
  been halted; the issue returns to the queue for a human decision.`
- Issue #26: **OPEN** (spec decision (c): stop at the revert).
- Branches: no `fix/gh-26`, no `loop/*` on origin (only the pre-existing
  stale `origin/fix/gh-{1,2,3,10}` from prior work items).
- Fresh clone of `main` (`b113686`), suite inside the image: **25 passed**
  (23 + the 2 contract tests, green against the restored buggy code).

## Deviations / operational notes

- **Exit-code capture masked by the tee pipeline.** The plan expected the
  CLI to exit 1 (a reverted issue is a harness-kind failure); the run.log
  records `RUN_EXIT: 0` because `$?` after `… | tee` reads tee's status,
  not the harness's. The harness's failure path does set
  `process.exitCode = 1` (`src/loop.ts` report path, unit-pinned in
  loop.test.ts since WI-6/WI-8); the true harness exit code was not
  captured. Orchestration evidence-capture mistake, recorded here; no
  harness defect — the failure line, revert, comment, and halt are all
  directly observed.
- The 213-byte first trigger (log existence) was judged too weak; the push
  waited for unambiguous agent Bash activity (>2 KB of real tool calls).
  Recorded so the re-drive trigger in the plan is understood as refined,
  not silently changed (Task 2b never ran — attempt 1 landed).

## Addendum (2026-09-19, WI-11 FR-004 — corrections by addition, nothing above rewritten)

- **PR-body and comment evidence (review findings A1/M1):** the durable
  GitHub-side evidence for the red-canary chain is (a) PR #27's body
  (`https://github.com/manjula25/loop-fixtures-py/pull/27` — the RED/GREEN
  sections quoting the repro test's failing-then-passing suite output),
  and (b) the `@manjula25 ⚠️ REVERTED` comment on that PR
  (issuecomment-5741234744). The "full chain observed" phrasing in
  WI-10/verification.md is best read as: every link observed in the
  artifacts cited here and in the run log — the MERGED/reverted summary
  lines, revert commit `b113686`, the comment author read-back — with
  PR #27's body completing the RED/GREEN link.
- **Exit-code note (review finding A2):** the canonical record of the
  tee-masked exit-code capture is the Deviations section above; later
  records citing it should point here rather than restating it.
