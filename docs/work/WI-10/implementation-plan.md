# WI-10 Implementation Plan — red-canary/revert live proof

Approved scope: `docs/work/WI-10/specification.md` (FR-001..FR-004; decisions
(a) one re-drive / 1 probe + ≤2 fix runs, (b) single-issue override, (c)
stop at the revert). Controller-executed pipeline-integration work item in
the WI-9 mold: no harness `src/` change is planned — the public seam is the
live run itself. If a harness defect surfaces, conditional Task 4 runs the
normal TDD path.

All harness-repo commands run inside the WI-10 worktree
(`.claude/worktrees/wi-10`, branch `worktree-wi-10`, created from local
`main` @ the spec-approval commit and fast-forwarded if needed). All
fixtures-repo work happens in clones of `manjula25/loop-fixtures-py`
(current `origin/main` = `b46c9ef`, suite **23 passed**; profile
`.loop-harness/profile.json`: `pip install -e ".[test]"` / `pytest -q`,
`baselineFailures: []`, `autoMerge: true`, `notifyHandle: "manjula25"`).

Host facts that shape commands: host `python3 -m pytest` is unavailable —
every suite check runs inside the committed `sandcastle-loop` image via a
temp script file in the worktree (`.tmp-*.sh`, deleted after; the
worktree-isolation guard refuses inline `docker run --entrypoint sh`
commands). The image ENTRYPOINT is `sleep infinity`, hence
`docker run --entrypoint sh …`. Model pinned `glm-5.2` (glm-5.3 400s on
the proxy; the PRD strong-model retry rule is the only other-model path).
`.env` is copied into the worktree root (untracked, never committed, never
echoed).

## Task 1 — worktree + preconditions + seed + conflicting-test prep (FR-001)

Steps (exact):

1. `EnterWorktree` name `wi-10` (base `origin/main`), then
   `git merge --ff-only main` inside it if local main is ahead. Copy
   `.env` from the repo root.
2. Baseline gates: `npm run typecheck` → exit 0; `npm test` → 10 files /
   216 tests, exit 0. Record in implementation-notes.md (created when
   implementation begins).
3. `npm run build:image` → builds `sandcastle-loop`;
   `npm run smoke:image` → **9/9 ok**;
   `npx tsx scripts/probe-agent.ts glm-5.2` → stdout `OK`, exit 0.
   **Ledger: 1 probe.**
4. Seed (zero LLM). In a fresh host clone
   `/tmp/wi10-seed-clone` of the fixtures repo, create
   `src/loopfix/moneyops.py` with exactly:

   ```python
   """Money helpers (WI-10 seed)."""

   def to_cents(amount: float) -> int:
       """Convert a dollar amount to integer cents.

       to_cents(1.50) == 150; to_cents(0.07) == 7; to_cents(2.0) == 200.
       """
       return int(amount)  # BUG: truncates to whole dollars, never converts
   ```

   Commit `seed(moneyops): add to_cents helper`, push to fixtures `main`.
   Expected: FF push, new main tip recorded as `<seed-sha>`.
5. Seed checks: fresh clone to `/tmp/wi10-lfclone`; via temp script
   `.tmp-seedcheck.sh` (git clone → `docker run --entrypoint sh
   sandcastle-loop -c 'pip install -e ".[test]" && python -m pytest -q'`
   on the clone) → **23 passed** (dormant: no test touches moneyops).
   Hand-check the defect: `to_cents(1.50)` → `1` (expected `150`).
   `npx tsx scripts/preflight-check.ts /tmp/wi10-lfclone` →
   `recorded baseline: [] / fresh run found: [] / MATCH`, branch
   auto-deleted, exit 0. Delete `.tmp-seedcheck.sh`.
6. File the issue (expected **#24**, record the actual): title
   `to_cents: dollar amounts truncated to whole dollars instead of cents`;
   body in the WI-1 clean style — symptom
   (`to_cents(1.50)` returns `1`), expected (docstring examples), minimal
   repro snippet. Verify OPEN via `gh issue list --state open` (it must be
   the ONLY open issue — check; if any other is open, stop and reconcile
   with the owner before spending).
7. Prepare the conflicting test (NOT pushed). In a second host clone
   `/tmp/wi10-conflict-clone` at `<seed-sha>`, create local branch
   `wi10-conflict` and add `tests/test_moneyops_contract.py` with exactly:

   ```python
   """Contract pinned by the billing team (WI-10 conflicting requirement).

   to_cents must return the whole-dollar part as an integer; fractional
   dollars are settled by the reconciliation job, never here.
   """

   from loopfix.moneyops import to_cents


   def test_to_cents_truncates_fractional_dollars() -> None:
       assert to_cents(19.99) == 19


   def test_to_cents_whole_dollars() -> None:
       assert to_cents(2.0) == 2
   ```

   Commit `test(moneyops): pin whole-dollar truncation contract`. Verify
   via `.tmp-conflictcheck.sh` (image suite on this clone) → **25 passed**
   (23 + 2; both new tests pass against the buggy code). Record
   `<conflict-sha>`. Delete the temp script. This branch is pushed ONLY at
   the timed moment in Task 2.
8. Evidence: `docs/work/WI-10/evidence/t1-seed.md` (preconditions, seed
   SHA, 23 passed, MATCH, issue number actuals, conflict SHAs, 25-passed
   proof, deviations).

Commit: `docs(WI-10): T1 seed evidence — moneyops seeded, issue filed,
conflicting test prepared` (docs/evidence only).

## Task 2 — the live run with the timed push (FR-002/FR-003)

Zero new harness code; the proving "test" is the run itself, observed
live. Steps:

1. Start the run from the worktree as a background task, teed verbatim:

   ```
   npm run loop -- --repo /home/bitcot/Documents/projects/loop-fixtures-py \
     --provider claude-via-proxy --model glm-5.2 --issue <N>
   ```

   (single-issue mode per decision (b); `<N>` = the actual issue number;
   no `--triage`). Primary artifact: `docs/work/WI-10/evidence/run.log`.
2. **The timed push.** Wait for the log line
   `[gh-N] Started on branch fix/gh-N`, then for
   `/home/bitcot/Documents/projects/loop-fixtures-py/.sandcastle/logs/fix-gh-N-gh-N.log`
   to exist and show agent activity (non-trivial size / agent output).
   Then immediately:
   `git -C /tmp/wi10-conflict-clone push origin wi10-conflict:main`
   (FF onto `<seed-sha>`). Record in `evidence/timing.md`: wall-clock
   time, the run-log byte/line offset at push, and the last main SHA
   before the push. Rationale recorded there: the branch base is pinned
   when the fix sandbox clones, so any push after agent activity starts
   is strictly after base-pinning, and the merge is minutes away
   (verification + review still to run) — the window is comfortable.
3. **Expected outcome (the success path):** the run completes with exit
   code **1** (a reverted issue is a harness-kind failure; the queue/CLI
   halts). The log shows, in order: verification green → PR created →
   pre-merge review approval → squash merge (`<merge-sha>`) → canary →
   the failure line matching the implemented vocabulary:
   `⚠️ REVERTED gh-N: merge <merge-sha> reverted after canary went red —
   canary new failures vs baseline on merged main: <conflicting test node
   ids>; revert: <revert-sha>; comment: posted; notify: manjula25`.
   No `✓ Closed issue` line (close happens only on a green canary).
4. End-states read back fresh via gh/git (never from the log alone),
   recorded in `evidence/run-endstates.md`:
   - fixtures `main` history: `<seed-sha>` → `<conflict-sha>` →
     `<merge-sha>` (squash) → `<revert-sha>`.
   - `main` tree: `moneyops.py` buggy (`int(amount)`),
     `tests/test_moneyops_contract.py` present,
     `tests/fixed-issues/test_gh_N.py` ABSENT (the revert removed it).
   - PR: **MERGED**, with the comment
     `@manjula25 ⚠️ REVERTED: the merge of this PR (<merge-sha>) was
     automatically reverted. … The run has been halted; …`.
   - Issue #N: **OPEN**.
   - No `fix/gh-N` / `loop/*` branches remain on origin.
   - Fresh clone of `main`, suite in image → **25 passed** (23 + the 2
     contract tests, green against the restored buggy code).

Commit: `docs(WI-10): run — canary red, merge reverted, run halted, notify
posted` (verbatim log + end-states + timing record).

### Task 2b (CONDITIONAL — only on a mistimed push; decision (a) allows exactly one)

- **Too early** (push beat base-pinning): symptom — the fix branch
  contains the contract test; verification goes red; log shows the fix
  FAILED (not REVERTED); exit 1. Recovery: in `/tmp/wi10-conflict-clone`,
  `git revert --no-edit <conflict-sha>` on a fresh `main` and push (main
  returns to seed content); re-create `wi10-conflict` on the new tip;
  re-run Task 2 with a later trigger (wait for the agent's first file
  edit in the fix log, not merely activity). **Ledger: fix run 2 of 2.**
- **Too late** (merge already canaried green): symptom — log ends
  `MERGED gh-N: … (canary: green)`, exit 0, issue CLOSED. Recovery: in
  `/tmp/wi10-conflict-clone`, `git revert --no-edit <merge-sha>
  <conflict-sha>` on `main` and push (main returns to seed content);
  `gh issue reopen <N>`; re-create `wi10-conflict` on the new tip; re-run
  Task 2. **Ledger: fix run 2 of 2.** The manual reverts are recorded in
  the evidence file as orchestration corrections, never as harness
  behavior.
- A SECOND mistiming ends the work item: record the honest failure
  (FR-002 boundary), spend ledger final, no third attempt.

## Task 3 — final verification and record (FR-004)

1. Confirm fixtures end-state (from Task 2 step 4) once more at a single
   pinned moment; capture the fresh-clone 25-passed run.
2. Harness gates fresh at the candidate: `npm run typecheck` exit 0;
   `npm test` 10/216 exit 0; `git status --short` clean;
   `git diff --stat <base>..HEAD` = docs/evidence only, zero `src/`.
3. Write `docs/work/WI-10/verification.md`: exact claim, per-FR evidence,
   spend ledger (1 probe + the actual fix-run count, 0 triage), non-claims
   (uncanaried-merge and teardown-failure surfaces remain unit-evidence
   only; the red canary was induced by a manufactured race, stated as
   such; invocation counts, not cost), remaining risks.
4. Then run `verification-before-completion` for the work-item completion
   record (per the lifecycle; separately invoked).

Commit: `docs(WI-10): verification — reverted surface live-proven on the
current tree`.

## Task 4 (CONDITIONAL — only if a harness defect surfaces)

Any defect: failing public-seam vitest test FIRST (RED), minimal fix,
focused `npm test -- src/loop.test.ts` GREEN, full gates, CLAUDE.md module
row amended in the same commit if a surface changes. Beyond repair scope →
back through the lifecycle (FR-004 boundary). Budget: no extra LLM spend
beyond any re-drive Task 2b already used.

## Rollback (safe sequencing)

- Before the timed push: nothing to roll back (seed + issue are additive;
  the conflict branch is local-only).
- After a completed run (any path): fixtures `main` is always recoverable
  by `git revert` of the named SHAs (the history is linear: seed →
  conflict → merge → revert); the issue can be closed/reopened manually;
  `wi10-conflict` is deleted after the work item ends.
- The harness repo is never the run target (constraint 1); no harness
  state mutates during runs beyond worktree docs.

## Spend ledger (planned ceiling per decision (a))

| Invocation | Trigger | Ceiling |
|---|---|---|
| Agent probe | Task 1 precondition | 1 |
| Fix run | Task 2 attempt 1 | 1 |
| Fix run | Task 2b re-drive (only if mistimed) | 1 |
| Triage | never (single-issue mode) | 0 |

Zero strong-model retries planned; any PRD-rule retry is named with its
reason. No spend beyond this table without owner approval.
