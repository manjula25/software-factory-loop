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

## Follow-ups this work item leaves open

- `.claude/worktrees/` is untracked and present in the working tree. Not WI-16's,
  and not touched.
- T1.3 raised `testTimeout` to 300_000 on the integration surface. It is a bound,
  not a budget: a scenario in T4 that legitimately needs longer must raise it with
  its own evidence rather than inherit the number silently.