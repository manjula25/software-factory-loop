# WI-8 Implementation Notes

Controller record for the implement loop over `docs/work/WI-8/implementation-plan.md`
(post-ponytail, headers normalized at `8693da2`).

Baseline (recorded 2026-09-19, worktree `.claude/worktrees/wi-8`, branch `worktree-wi-8`,
base `main` @ `3c3f214`): clean tree; `npm run typecheck` exit 0; `npm test` 10 files /
207 tests exit 0.

---

## Task 1 — preflight & verification teardown parity (FR-001, slice 1)

- **Size:** medium (two `finally` blocks gain their own try/catch, one outcome
  field threading through `fail()`/`prOutcome`/abort return, a runQueue FAILED-line
  suffix, a doc-comment generalization; 4 new tests + 4 test knobs).
- **Risk:** medium — touches the same code region as WI-7 FR-003 (runSingleIssue's
  sandbox lifecycle) and the queue summary's FAILED line (exact-pinned by existing
  tests — the suffix must stay absent when no teardown failure exists).
- **Budget:** one leaf implementer session; vitest only, no Docker, no network.
- **Evidence boundary:** loop seam with throwing teardown deps (WI-7 FR-003 idiom);
  no pipeline-integration claim; teardown not retried.
- **Fixed point:** `8693da2` (clean tree, baseline recorded above).
- **Intended candidate:** working tree vs `8693da2`; commit message
  `fix(WI-8): preflight/verification teardown recorded, never deciding or erasing the outcome (FR-001)`.

### Checkpoint record — ACCEPTED 2026-09-19

**Candidate:** `a30c4ac` (commit `fix(WI-8): preflight/verification teardown
recorded, never deciding or erasing the outcome (FR-001)`), base `8693da2`.
Changed paths: `src/loop.ts`, `src/loop.test.ts` (the only two permitted).

**Leaf report:** one leaf session; no deviations of substance. Count-arithmetic
note: the brief's "focused reaches 211" conflated the full-suite baseline with
the focused file (focused = 99+4 = 103; full = 207+4 = 211, the pinned number).
The exact-pinned FAILED line captures the pre-existing double period
("Re-run onboarding..") verbatim rather than silently fixing it.

**RED (leaf-observed, pre-fix, 4 failed / 99 passed):** (a)–(c) raw
`Error: docker: container rm failed — busy` thrown out of `runSingleIssue` at
the verification finally (src/loop.ts:737) and the preflight finally (:641) —
green outcome erased, abort reason replaced, run killed before `runFixRun`;
(d) `expected Error: docker: preflight container rm fai… to be an instance of
QueueAbortedError` — raw close() throw propagated instead of the abort.
Exactly the planned observations.

**GREEN (leaf, re-run fresh by the controller at `a30c4ac`):** focused
`src/loop.test.ts` 103/103 exit 0; `npm run typecheck` exit 0; full `npm test`
10 files / 211 tests (207+4) exit 0.

**Reviews (fixed package base `8693da2` → candidate `a30c4ac`, both paths
accounted):**
- Specification review: **PASS**, zero blocking. Verified catch placement
  (only teardown steps wrapped), byte-stable abort/fail reason strings,
  earlyTeardown precedence and flow into reviewSkip/mergeFailure/merged
  returns, strictly-conditional FAILED suffix, RED genuineness against the
  base tree's unwrapped finallys, scope clean.
- Code-quality review: **APPROVED**, zero critical/important. Conditional
  spreads and error extraction match sibling idiom; knobs follow the WI-7
  per-target-matching lesson; no new unguarded emission.

**Adjacent follow-ups (recorded, not fixed):**
- Canary-wins precedence: if both an early teardown and the canary teardown
  fail, the canary's reason overwrites `earlyTeardown` on the merged outcome
  and MERGED line (single-field structure, pre-existing; spec-review and
  quality-review both flagged as doc-precision only).
- fail()-path sandboxTeardown drop is the brief-sanctioned gap (declared
  before the sandbox exists); documented in-code and here.
- 137-char line at the failed.push suffix; a shared teardown-suffix helper
  with the MERGED formatter could unify — taste, not worth restructuring.
- Tripled throwOnClose override blocks in makeDeps match the factory's
  existing per-branch idiom.

**Evidence boundary / non-claims:** vitest public-seam + tsc only; teardown
failures exercised via throwing-dep knobs (WI-7 FR-003 idiom); no
Docker/gh/pipeline-integration run; teardown not retried.

---

## Task 2 — single-issue report carries the teardown line (FR-002, slice 2)

- **Size:** small-medium (extract `main()`'s single-issue print block into an
  exported pure builder + a thin guarded print loop; one new stderr line,
  strictly conditional; 3 new tests, scaffold-first RED).
- **Risk:** medium — moves CLI-adjacent print logic that existing tests do NOT
  cover directly (they verify at the runOverrideIssue seam); the extraction
  must keep every existing line byte-identical and the guard in `main()`.
- **Budget:** one leaf implementer session; vitest only.
- **Evidence boundary:** the builder is unit-proven; `main()`'s thin print
  loop is typechecked + seam-verified (house precedent), not CLI-executed.
- **Fixed point:** `dff96ff` (clean tree, T1 accepted).
- **Intended candidate:** working tree vs `dff96ff`; commit message
  `feat(WI-8): single-issue report carries a recorded teardown failure line (FR-002)`.
