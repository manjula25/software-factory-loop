# WI-12 — Implementation notes

Controller: top-level session. Plan: `docs/work/WI-12/implementation-plan.md`
(post-ponytail `003fbd1`). Spec: approved `940533f` (FR-001..FR-004, d1–d2).

## Task 0 — Worktree + baseline (controller, 2026-09-19)

- Worktree `.claude/worktrees/wi-12`, branch `worktree-wi-12`, from main `003fbd1`.
- `npm ci`: ok. `npm run typecheck`: exit 0. `npm test`: **10 files / 219 tests passed** (1.23s).
- Baseline green — dispatch authorized.

## Checkpoints

### T1 — FR-001 uncanaried early-teardown recording (accepted 2026-09-19)

- Candidate `4015205` (base `003fbd1`). Implementer: one leaf, no deviations.
- TDD: observed RED — `outcome.teardownFailure` undefined on the uncanaried
  outcome (`AssertionError` at the new test's first teardown assertion); GREEN —
  one conditional spread mirroring the reverted lift (`src/loop.ts:1108` idiom).
- Controller gates fresh at candidate: typecheck exit 0; `npm test` 10 files /
  220 tests. Pure-addition diff (0 deletions) — existing uncanaried pins
  unmodified.
- Spec review: **PASS** (covers T1/FR-001 at `4015205`). Adjacent findings
  recorded, not expanded:
  - A1: (q2) does not assert the uncanaried detail's `notify: @manjula25`
    rendering (plan listed it; spec's success criteria do not require it).
  - A2: only the verification-close arm of the early origin exercised; the
    preflight arm rides the same `earlyTeardown` field by construction
    (`src/loop.ts:800-812`) and is pinned by WI-11 fail-path tests.
- Code-quality review: **PASS**. Two TASTE findings (duplicated CLOSE literal
    vs (e2); "(q2)" label without a "(q1)" sibling) — taste never blocks; label
    taken verbatim from the approved plan.

### T2 — FR-002 present-handle @-rendering unification (accepted 2026-09-19)

- Candidate `d37c171` (base `9983178`). Implementer: one leaf, one deviation.
- TDD: observed RED — (f3) failed with the live bare rendering
  (`…; comment: posted; notify: manjula25`); GREEN — one production arm
  (`notify: @${handle}`), absent arm untouched.
- **Sanctioned pin supersession recorded** (spec FR-002, the batch's only one):
  WI-11 FR-003's bare contrast pin in test (f2) superseded to
  `notify: @manjula25` in the same commit as the production change, with the
  (f2) comment and title parenthetical updated to mark the supersession.
  The bare form was the WI-10 live observation; WI-12 (d1) unifies on @,
  matching the uncanaried detail and the queue REVERTED line.
- Deviation (accepted): the brief's suggested discriminator failed typecheck
  (`TS18048`); implementer used `present.failure!.split("notify: ")[1]?.startsWith("@")`
  — the `!` pattern has file precedent and is provably safe (the preceding
  `toContain` throws first).
- Controller gates fresh at candidate: typecheck exit 0; `npm test` 10 files /
  221 tests.
- Spec review: **PASS**. Adjacent: notes-recording requirement (this entry);
  (f2)/(f3) pin duplication (taste).
- Code-quality review: **PASS**. Two TASTE: the (f3) split discriminator is
  redundant defense-in-depth (kept); the (f2)/(f3) duplication kept
  deliberately with a cross-reference.


