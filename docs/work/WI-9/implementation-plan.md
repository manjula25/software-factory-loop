# WI-9 Implementation Plan

Branch `worktree-wi-9` (worktree `.claude/worktrees/wi-9`), base `main` @
`59ad70b`. Traced to `docs/work/WI-9/specification.md` (FR-001…FR-004,
approved `59ad70b` — including both design decisions: red canary = success;
deferral via follow-up invocation) and `slices.md` (slices 1–3).

This is a **pipeline-integration work item**: the proving commands are live
runs against `manjula25/loop-fixtures-py` in local Docker, not vitest RED
steps. The born-red reproduction test each fix run writes IS the RED
evidence, captured in the run log and PR body. Harness-source TDD applies
only to defect fixes (FR-004, conditional Task 5).

Harness baseline (recorded at plan time, main @ `59ad70b`): `npm test`
10 files / 216 tests exit 0; `npm run typecheck` exit 0. Expected unchanged
unless a defect fix lands.

Commands (authoritative list, `docs/agents/workflow.md`): harness —
`npm run typecheck`, `npm test`; pipeline — `npm run build:image`,
`npm run smoke:image` (9 checks), `npm run loop -- --repo <dir>
--provider claude-via-proxy [--model glm-5.2] [--triage]`. No lint exists.
Model pinned to `glm-5.2` (proven on the proxy; glm-5.3 400'd on 2026-09-14 —
the PRD's strong-model retry rule is the only path to a different model).

Environment facts this plan relies on (verified 2026-09-19): fixtures clone
at `/home/bitcot/Documents/projects/loop-fixtures-py`, clean, on `main`;
profile `.loop-harness/profile.json` = python / `pip install -e ".[test]"` /
`pytest -q`, `baselineFailures: []`, `autoMerge: true`, `notifyHandle:
"manjula25"`; all 7 existing issues CLOSED; modules `src/loopfix/{textops,
dates}.py`, tests `tests/test_{textops,dates}.py` + `tests/fixed-issues/`.
`.env` lives untracked at the harness repo root — the worktree gets a copy
(cp, never committed, never echoed).

---

### Task 1: worktree + environment preconditions + seed (FR-001, slice 1)

Files: harness — none in `src/`; evidence `docs/work/WI-9/evidence/`.
Fixtures repo — `src/loopfix/numops.py` (new), two new issues via gh.

1. **Worktree + gates:** create `worktree-wi-9` from `main` @ `59ad70b` per
   `using-git-worktrees`; record baseline (typecheck, full suite). Copy
   `.env` into the worktree root (untracked; never commit, never echo).
2. **Image + smoke:** `npm run build:image` then `npm run smoke:image` —
   expect 9 checks passing. (Zero LLM.)
3. **Agent probe:** `npx tsx scripts/probe-agent.ts` with the pinned model —
   expect `OK`, exit 0. (One minimal API call — accounted in FR-003's
   ledger.) If it fails, stop and diagnose before any spend.
4. **Seed (fixtures repo, zero LLM):** add `src/loopfix/numops.py` with two
   functions whose docstrings describe the CORRECT behavior but whose
   implementations are wrong:

   ```python
   """Numeric helpers (WI-9 seed)."""


   def clamp(value: float, lo: float, hi: float) -> float:
       """Clamp value into [lo, hi].

       clamp(-5, 0, 10) == 0; clamp(15, 0, 10) == 10; clamp(5, 0, 10) == 5.
       """
       return min(value, hi)  # BUG: lo never applied


   def mean(values: list[float]) -> float:
       """Arithmetic mean.

       mean([1, 2]) == 1.5; mean([2, 4, 6]) == 4.0; raises ValueError on empty.
       """
       if not values:
           raise ValueError("mean() of empty list")
       return sum(values) // len(values)  # BUG: floor division, not true mean
   ```

   Commit to fixtures `main` as `seed(numops): add clamp and mean helpers`
   and push. No tests for these functions are committed (dormant bugs).
5. **Seed checks:** in the existing fixtures clone pulled forward:
   `pip install -e ".[test]"` + `pytest -q` — expect the same passing count
   as before the seed (green; only new source, no new tests). The clean-room
   property is carried by the preflight: `npx tsx scripts/preflight-check.ts`
   (from the worktree, against the fixtures repo) — expect baseline MATCH in
   its fresh Docker sandbox, throwaway preflight branch auto-deleted (and
   Task 4's fresh scratch clone is the final clean-room proof).
6. **Issues:** create two issues on `manjula25/loop-fixtures-py` (next
   sequential numbers — expected #21/#22; record actuals):
   - **clamp issue** (plain style): title `clamp: negative values fall
     through below lo`; body: symptom (`clamp(-5, 0, 10)` returns `-5`,
     expected `0`), expected behavior from the docstring, minimal repro
     snippet, and a hand-written failing REPL block.
   - **mean issue** (messy-log style): title `mean: floor division truncates
     the average`; body: symptom (`mean([1, 2])` returns `1`, expected
     `1.5`), expected behavior, and a deliberately messy inline traceback
     log block (interleaved paths/timestamps) so attachment discovery runs
     on a real noisy body.
7. **Evidence commit (harness repo):** `docs/work/WI-9/evidence/t1-seed.md`
   — issue URLs/numbers, seed commit SHA, suite-green output, preflight
   MATCH line, probe OK.
   Commit message: `docs(WI-9): T1 seed evidence — numops seeded, issues filed, suite green, preflight MATCH`

### Task 2: run 1 — higher-ranked issue through the full chain (FR-002/FR-003, slice 2)

Files: evidence `docs/work/WI-9/evidence/run1.log`, `run1-endstates.md`.

1. **Run (from the worktree):**
   `npm run loop -- --repo /home/bitcot/Documents/projects/loop-fixtures-py --provider claude-via-proxy --model glm-5.2 --triage 2>&1 | tee docs/work/WI-9/evidence/run1.log`
2. **Expected observable chain in the log:** 2 eligible on acquisition; one
   triage pass (raw scores land in `.sandcastle/logs/loop-triage-*.log` —
   both issues will name `src/loopfix/numops.py` + the new repro-test file);
   higher-ranked issue: born-red repro (verbatim FAILED lines in the PR
   evidence), fix, fresh-sandbox verification diff vs baseline clean,
   pre-merge diff-review approval, squash-merge, canary green on merged
   main, issue auto-closed; lower-ranked issue: `NOT ADMITTED gh-<n>: file
   overlap with gh-<m>`; exit 0.
3. **Read back fresh (not from the log):** `gh issue view` both issues
   (one CLOSED, one OPEN), `gh pr view` the merged PR (MERGED, body carries
   RED/GREEN sections), `git -C …/loop-fixtures-py fetch && git log
   origin/main --oneline -3` (squash merge + canary-clean history), no
   leftover `fix/gh-*`/`loop/*` branches.
4. **Spend ledger entry:** 1 triage pass + 1 fix run + 1 probe (T1).
5. **Failure handling:** any inexplicable failure → one strong-model re-run
   of that issue (PRD rule), recorded. Any harness defect → Task 5
   procedure, then re-drive from a clean state.
   Commit message: `docs(WI-9): run 1 — <issue> merged green via full chain, <issue> deferred file-overlap`

### Task 3: run 2 — the deferred issue completes (FR-002/FR-003, slice 2)

Files: evidence `docs/work/WI-9/evidence/run2.log`, `run2-endstates.md`.

1. **Run (identical command, no `--triage` needed — 1 eligible):**
   `npm run loop -- --repo /home/bitcot/Documents/projects/loop-fixtures-py --provider claude-via-proxy --model glm-5.2 2>&1 | tee docs/work/WI-9/evidence/run2.log`
   (If the queue reports >1 eligible — e.g. an unexpected third — stop and
   reconcile before spend.)
2. **Expected:** the deferred issue admitted (its blocker's fix already on
   main — re-admission proof), born-red repro against the already-merged
   first fix's suite state, fix, verify, merge, canary green, auto-close;
   exit 0. NO triage pass (single eligible).
3. **Read back fresh:** both issues CLOSED; both PRs MERGED with evidence
   bodies; `origin/main` carries both squash merges.
4. **Spend ledger entry:** 1 fix run (running total: 2 fix + 1 triage +
   1 probe — matches FR-003's plan).
   Commit message: `docs(WI-9): run 2 — deferred issue merged green; both issues closed`

### Task 4: final verification record + non-claim closure (FR-002/FR-004, slice 3)

Files: `docs/work/WI-9/verification.md`.

1. **Final-state proof:** fresh scratch clone of fixtures `origin/main`:
   `pip install -e ".[test]"` + `pytest -q` — expect green with BOTH new
   reproduction tests present (`tests/fixed-issues/`) and both fixes present
   in `src/loopfix/numops.py` (clamp applies lo; mean true division).
2. **Record:** verbatim run-log references, PR/merge/issue end-states, spend
   accounting (FR-003), probe call, the two approved design decisions
   applied, and the explicit closure of the standing pipeline-integration
   non-claim for the delivered tree. Non-claims that remain: failure-path
   surfaces (teardown/uncanaried/revert) unit-proven only; no fault
   injection was attempted.
3. **Gates:** harness `npm test` + `npm run typecheck` fresh at the
   worktree HEAD (expected 216/10 unless Task 5 landed).
   Commit message: `docs(WI-9): verification — both issues fixed live through the opt-in chain; standing non-claim closed`

### Task 5 (conditional): live defect fix (FR-004)

Triggered only by a defect the live run exposes. Procedure, per defect:
record the live symptom verbatim from the run log → failing public-seam
vitest test FIRST (observed RED at the harness seam — `src/` + colocated
`*.test.ts`) → minimal fix → focused + full suite + typecheck green →
commit → re-drive the affected run from a clean state (branches/PRs cleaned
or superseded; spend of the re-drive enters the ledger with its trigger).
Commit message: `fix(WI-9): <defect summary> (found live in run <n>)`.
A defect needing behavior change beyond repair scope stops the loop and goes
back through the lifecycle (grilling → spec), per FR-004's boundary.

---

## Sequencing and rollback

Strict order: 1 → 2 → 3 → 4; Task 5 slots in wherever a defect surfaces and
re-drives from that point. Rollback safety: seeds are additive (a bad seed =
close the issue, revert the fixtures commit); every run's artifacts are PRs
on the fixtures repo (revertable) + logs committed as evidence; harness-repo
commits are docs-only except Task 5 fixes, each its own revertable commit
with a failing test proving it. Spend is bounded by the cap machinery
(default 3) plus the PRD retry rule, and stops entirely on Task 5.

## Evidence boundaries and non-claims (whole plan)

- Live evidence is local Docker + real gh against the harness's own fixtures
  repo; no cloud sandbox (constraint 6); no client data (constraint 3).
- Failure-path surfaces are NOT exercised deliberately (WI-7/WI-8 unit
  evidence stands); a naturally occurring revert/uncanaried/teardown event
  is recorded as evidence under design decision (a).
- `main()`'s CLI wiring runs live; no new unit claims about it.
- Spend claims are invocation counts, not cost figures.

## Completion gate (controller-run)

At the worktree HEAD after Task 4: harness gates fresh (full suite +
typecheck), both issues CLOSED with merged PRs on the fixtures repo, the
final fresh-clone state green with both repro tests and fixes present, the
spend ledger matching FR-003's plan (2 fix runs + 1 triage pass + 1 probe,
± recorded retries), verification.md closing the standing non-claim, and
every Task 5 defect (if any) carrying its RED/GREEN record.
