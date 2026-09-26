# WI-16 Implementation Notes

Chronological ledger. Entries record what was believed and done at each checkpoint.
Corrections are **appended**, never rewritten into the entry they correct — see
CLAUDE.md, "Correcting a record already written". The standing claims live in
`verification.md`; this file is the history.

Plan: `docs/work/WI-16/implementation-plan.md` (T1). Ticket:
`docs/work/WI-16/tickets/t1-fixture-repository.md`.

---

## 1. T1.1 — the integration test surface — 2026-09-25

Added `vitest.integration.config.ts`, the `test:integration` npm script, and `tests`
to `tsconfig.json`'s `include`. No `src/` change.

RED observed and recorded to `evidence/t1-surface-no-tests.log`: `exit=1`,
`No test files found, exiting with code 1` — `passWithNoTests: false` doing the
work. `npm test` still 10 files / 287 tests; typecheck exit 0.

Commit `0c786b0`.

## 2. T1.2 — the fixture identity and its absence guard — 2026-09-25

Added `tests/integration/fixture.ts` and `tests/integration/fixture.test.ts`.

First RED attempt put the guard in a `beforeAll` and reported **3 skipped tests
under one failed suite**. Judged weaker evidence than three real failures and
restructured: `assertFixtureReady` is now called inside each `it`, so an absent
fixture yields three failures each carrying the setup instruction. The recorded
RED in `evidence/t1-guard-absent-fixture.log` is `Tests 3 failed (3)`, `exit=1`.

Also caught in this step: the first capture of that RED read `exit=0`, because an
intervening `echo` reset `$?` before it was read. Recaptured with `rc=$?`
immediately after the command — the recorded log carries the true `exit=1`. Lesson
added to CLAUDE.md (commit `32479c8`).

Commit `72015af`.

## 3. T1.3 — provisioning the fixture and its issue — 2026-09-25

Outward-facing; run under the owner's explicit authority given 2026-09-25.

### The seed, as committed

- **Commit:** `a4348dafa4aa328b908692ed46a1d4ddf9796fd7`
- **Subject:** `seed: loopsample with a latent truncate defect`
- **Author:** `manjula <manjula@bitcot.com>` — the practice repo's seed identity
- **Seven tracked files**, the profile among them:
  `.gitignore`, `.loop-harness/profile.json`, `README.md`, `pyproject.toml`,
  `src/loopsample/__init__.py`, `src/loopsample/textops.py`, `tests/test_textops.py`

Built at `/tmp/wi16-seed/loop-integration-fixture` — a fixed path rather than the
plan's `$(mktemp -d)`, so the seed can be re-inspected after the fact. Harmless
deviation; the plan's point was only "outside this repo".

`git rev-parse --show-toplevel` was run **before** `git init` and failed
("not a git repository"), per the repository's lesson about un-initialized
directories silently joining a parent repo.

### The issue, as filed

- **Number:** **1** — the only open issue on the fixture
- **Title:** `truncate() returns one character more than the limit`
- **Labels:** none. **No attachment URL, no cause stated** — symptom only.
- **Normalized id:** `gh-1`. `src/issues.ts:38` sets `id: \`gh-${issue.number}\``, so
  the number is the id.
- **Reproduction test scenario 1 will write:** `tests/fixed-issues/test_gh_1.py`,
  per `src/loop.ts:438–440` (`reproTestPath`). The practice repo carries a
  `test_gh_1.py` in exactly that directory, so the shape is not invented.

### Born-green and latent defect, both checked before the repository existed

In `sandcastle-loop`, against a read-only mount: `pytest -q` → `3 passed`,
`PYTEST_EXIT=0`. The defect probe `truncate("abcdefghij", 5)` → `'abcde…'`,
`len=6`. The docstring states the correct contract
(`truncate("abcdef", 4) == "abc…"`) and the code violates it, so the issue's stated
symptom *and* its expected value are both accurate.

### How the fixture's `.gitignore` differs from the practice repo's

Diffed, not counted:

```
$ diff /home/bitcot/Documents/projects/loop-fixtures-py/.gitignore \
       /tmp/wi16-seed/loop-integration-fixture/.gitignore
7d6
< .loop-harness/
```

One removed line, and nothing else. The practice repo lists `.loop-harness/`; the
fixture does not, which is D2. Verified the other direction too:
`git ls-files | grep loop-harness` in the practice repo prints nothing, so the
profile there is untracked local state and D2's "one deliberate structural
difference" holds.

### Read back, not assumed

```
gh repo view → {"visibility":"PUBLIC","defaultBranchRef":{"name":"main"},"isEmpty":false,...}
git ls-remote --symref origin HEAD → a4348daf… HEAD   (equal to the seed commit)
gh issue list --state open → exactly one, #1
```

### Deviation — T1.2's third test could never have passed

The first run against the live fixture **failed on the clock**: the third test does
a cold `gh repo clone` plus a container run with `pip install` (~14s) and inherited
vitest's 5000ms default. `testTimeout` raised to `300_000` in
`vitest.integration.config.ts` — that file alone, so `npm test` is untouched. Lesson
added to CLAUDE.md (commit `3342d4e`). Commits `a845b6d`, `84e2f31`.

### Deviations — three numerals that disagreed with their own lists

All found while working, all corrected in the plan in place:

1. "The seed — exact contents" said **eight files**; its own list names **seven**.
   Corrected before the seed was built. No eighth file exists — the practice repo
   carries no `tests/__init__.py` and no committed profile, so nothing was dropped,
   only the numeral was wrong. Commit `838f518`.
2. The T1.3 command block's comment said "the eight files". Corrected to seven.
3. T1.5 said "the four `.gitignore` decisions", contradicting its own
   parenthetical ("nothing else"). Diffed to one line. Both corrected at T1.5.

### Deviation — trailing newlines

All seven seed files were first written without a trailing newline; every file in
the practice repo ends with one. Appended before the commit, so the seed commit
carries the conventional form.

## 4. T1.4 — the guard's planted-defect pair — 2026-09-25

Constant pointed at `manjula25/loop-integration-fixture-does-not-exist` → 3 failed,
each carrying the setup instruction from its own call site (`fixture.test.ts:40`,
`:27` via `:51`, `:32` via `:59`). Constant restored, confirmed byte-identical by an
empty `git diff` **before** the second run → 3 passed.

Recorded to `evidence/t1-guard-planted-defect.log`, which also states what the pair
does not prove: it is a check on the guard's *firing*, not on the suite's strength.

Commit `40dee59`.

## 5. T1.5 — provenance and verification — 2026-09-25

This file and `verification.md`. No source change.

---

---

## 6. T2.1 — the born-red scripted-agent surface — 2026-09-26

Plan: `implementation-plan-t2.md` (approved with the ticket set). Worktree
`wi-16-t2` off `9915ef5`; baselines re-taken there before any edit — typecheck
`exit=0`, `npm test` 10 files / 287 tests, `npm run test:integration` 3 passed
(144.57s), matching the plan's recorded base.

`tests/integration/fixture.ts` gained `TEST_IMAGE`, `assertImageBuilt` /
`ImageNotBuiltError` (build instruction: `npm run build:image:test`) and
`ensureFixtureClone`, which exports T1's private clone-if-absent; T1's test now
calls the exported one and its private copy is gone.

RED recorded to `evidence/t2-image-missing-red.log`: `Tests 2 failed | 3 passed`,
both failures `ImageNotBuiltError` carrying the build instruction. Unit gate and
typecheck unchanged.

Commit `80b852e`.

## 7. T2.2 — the image and the agent, first green — 2026-09-26

Delivered as planned: `.sandcastle/Dockerfile.test` (three lines, `FROM
sandcastle-loop` plus one `COPY --chmod=0755`), `.sandcastle/scripted-agent/claude`
(Python 3), `build:image:test` in `package.json`, the workflow.md integration-tests
row (which also records T1's `test:integration` — added by T1 without landing it
in the authoritative command list; corrected here per CLAUDE.md's rule, same PR),
and one CLAUDE.md paragraph for the integration surface.

Direct smoke, before any harness involvement: `which claude` inside the image
resolves to `/home/agent/.local/bin/claude` with the script's `#!/usr/bin/env
python3` shebang (the shadow, not a PATH accident); a review-shaped prompt yields
the three NDJSON lines with `<review>approve</review>`; an unrecognised prompt
exits 1 with the stderr message (D4's loud branch).

### Deviation — three defects between the plan's facts and the runner's behaviour

The plan's "repository facts" were verified against `dist/index.js` text but not
against a live `run()`. The first green attempt failed 2/2, and the diagnosis
corrected the plan in place (see items below); all three fixes are in the
test-only script, so FR-003's "no `src/` change" held — no stop condition fired.

1. **The runner post-captures a session transcript.** After the agent exits, the
   claude-code provider `docker cp`s
   `/home/agent/.claude/projects/<cwd with / as ->/<session_id>.jsonl`
   (`dist/index.js:2607`, `encodeProjectPath` at `:2598`). A `session_id` in the
   init event with no such file on disk is a `SessionCaptureError` that fails the
   whole run. The script now writes that file itself (`write_session_transcript`)
   — still no network.
2. **The plan's stdout-assembly fact was wrong.** Assistant text events feed the
   live display and the completion-signal detector only; the value returned as
   the run's `stdout` is `resultText || execResult.stdout` — the **result**
   event's string alone (`dist/index.js:262–305`, assembly at `:513`). D7 said
   the opposite ("evidence/verdict text rides the assistant event"). Corrected in
   the plan in place; the script now carries the full report/verdict in the
   result event (the assistant event stays, for stream fidelity).
3. **`tests/fixed-issues/` does not exist in the seed**, so `open(REPRO_PATH,
   "w")` raised `FileNotFoundError`. The script creates the directory first.

GREEN recorded to `evidence/t2-adapter-green.log`: `Tests 5 passed (5)` (T1's 3 +
T2's 2, 149.68s); unit gate and typecheck re-checked unchanged.

The plan's pip-as-`agent` risk did not bite: `pip install -q -e ".[test]"` as the
non-root user succeeded via the user site (warning only), as the plan's T2.2
observation anticipated.

Commit `d89ebee`.

## 8. T2.3 — planted-defect pairs — 2026-09-26

Pair 1 (fix side): the script's report without the `<green-evidence>` block →
exactly the fix test fails, `expected '…' to contain '<green-evidence>'` — the
same observation `extractEvidence` throws on in production. Pair 2 (review
side): `<review>wrong</review>` → exactly the review test fails,
`expected 'wrong' to be 'approve'` through `parseReviewOutput`. Each revert was
confirmed byte-identical by an empty `git diff --quiet` (rc 0) **before** its
green re-run; both green re-runs are `Tests 5 passed (5)`.

Recorded to `evidence/t2-planted-defects.log`. Commit `2499b90`.

## 9. T2.4 — records — 2026-09-26

This entry and the T2 section of `verification.md`. The plan's corrected
stdout-assembly fact and D7 are corrected in place in `implementation-plan-t2.md`
with this ledger entry as the correction's record.

## 10. T3 — the scenarios command, the reset, the guard — 2026-09-26

**T3.1 (born red, `d7f83c2`):** the red mechanism deviated from the plan on
purpose, corrected in place before the run: a missing `fixture-reset.js` module
would also fail `npm run typecheck` (tsconfig includes `tests/`), and T1/T2 kept
every gate green at red. The stub exports everything and throws per function —
`npm run test:scenarios` → 4/4 failed on substance, exit=1
(`evidence/t3-surface-red.log`); typecheck, `npm test` (287), and
`test:integration` (5, 149.68s) all rc=0. Two later test-file fixes before the
first machinery run: the planted live holder must be a genuinely live pid
(`spawnSync` waits, so its child is dead on return — the test now plants its own
`process.pid`), and removing preconditions by PATH surgery is fragile — the
docker case uses a dead `DOCKER_HOST`, the gh case an empty `GH_CONFIG_DIR`
(plus stripped token env vars, so a teammate's `GH_TOKEN` cannot save it).

**T3.2 (first green, `0e10076`):** the guard acquires with an atomic mkdir,
refuses naming a live holder, steals a dead/corrupt one; the reset closes PRs,
deletes non-main branches, force-puts main at the seed, verifies all four
properties itself. The first green attempt failed 2/4: the hand-mutation's
scratch clone pushed to a path remote that never reached GitHub (fixed: clone
the fixture's real remote URL), and the empty-queue invocation outran the 300s
default — one gh API POST costs ~16s from this network; the run measured
standalone at 111s rc=0, and the test now carries 480s with that measurement
in a comment (the follow-up below, honored as designed). Green: 4/4, 578.38s,
exit=0 (`evidence/t3-command-green.log`).

**T3.3 (planted defects, `27390f3`):** the plan's first pair was wrong —
dropping `gh pr close` alone is NOT catchable, because deleting a PR's head
branch on GitHub auto-closes the PR (the run passed; plan corrected in place,
the branch deletion is the catchable defect). The force-push pair needed the
mess to advance main — a killed post-merge run's shape — or dropping the force
changes nothing the assertions see; the hand-mutation now pushes a junk commit
to main too. And a red that dies mid-mess leaves timestamp-unique junk commits
whose next push is rejected non-fast-forward before the reset under test runs,
so the test resets BEFORE mutating (self-healing start). Both surviving pairs
red→empty-diff-revert→green in `evidence/t3-planted-defects.log`; the two
gh-heavy tests carry explicit 480s timeouts.

**T3.4 (command-level precondition RED, `5393e1a`):**
`DOCKER_HOST=unix:///nonexistent-t3.sock npm run test:scenarios` → exit=1, 4/4
failed naming the docker precondition verbatim
(`evidence/t3-precondition-red.log`); PATH-stripping corrected in place as both
fragile and over-broad (it would remove gh with docker).

**T3.5:** this entry and the T3 section of `verification.md`, with a fresh full
4/4 re-capture at the final code identity appended to
`evidence/t3-command-green.log` (the original 4/4 predates the T3.3 test
extension). Changed-path range check, `git diff --name-only 4701f21..5393e1a` —
exactly 11 files, none under `src/`: `CLAUDE.md`, `docs/agents/workflow.md`,
`docs/work/WI-16/evidence/t3-{surface-red,command-green,planted-defects,precondition-red}.log`,
`docs/work/WI-16/implementation-plan-t3.md`, `package.json`,
`tests/scenarios/command.test.ts`, `tests/scenarios/fixture-reset.ts`,
`vitest.scenarios.config.ts`.

## Follow-ups this work item leaves open

- `.claude/worktrees/` is untracked and present in the working tree. Not WI-16's,
  and not touched.
- T1.3 raised `testTimeout` to 300_000 on the integration surface. It is a bound,
  not a budget — and T3 exercised the sanctioned escape: the two gh-heavy
  scenario tests each carry an explicit 480_000 with the latency measurement in
  a comment (~16s per gh API POST; the empty-queue run is 111s standalone).
- D6's open question stands for T4: the reset does not touch issues or labels —
  whether a scenario needs issue-state reset is T4's to answer with a scenario
  that cares.


