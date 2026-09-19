# WI-7 Implementation Notes

Controller record for the implement loop over `docs/work/WI-7/implementation-plan.md`
(post-ponytail, headers normalized at `a91e8a5`).

Baseline (recorded 2026-09-19, worktree `.claude/worktrees/wi-7`, branch `worktree-wi-7`,
base `main` @ `391d2de`): clean tree; `npm run typecheck` exit 0; `npm test` 10 files /
195 tests exit 0.

---

## Task 1 — acquisition-time remote refresh (FR-001, ticket 1)

- **Size:** small-medium (one required dep on `QueueDeps`, one await in `splitQueue`,
  one real wiring in `main()`, plus queue/loop test dep-factory updates).
- **Risk:** medium — touches the live dedup seam `splitQueue`; making
  `refreshRemoteRefs` required forces dep-factory edits across queue and loop test
  suites (compile breakage risk if any factory is missed).
- **Budget:** one leaf implementer session; tool budget = vitest focused runs +
  real-git throwaway repos (mkdtemp), no Docker.
- **Evidence boundary:** unit seam (`src/queue.test.ts`) + real-git stale-clone
  scenario; no pipeline-integration claim.
- **Fixed point:** `a91e8a5` (clean tree, baseline recorded above).
- **Intended candidate:** working tree vs `a91e8a5`; commit message
  `feat(WI-7): acquisition-time remote refresh — fetch/prune before dedup (FR-001)`.

### Checkpoint record — ACCEPTED 2026-09-19

**Candidate:** `7d84b10` (commit `feat(WI-7): acquisition-time remote refresh —
fetch/prune before dedup (FR-001)`), base `a91e8a5`. Changed paths: `src/queue.ts`,
`src/queue.test.ts`, `src/loop.ts` (main() wiring only), `src/loop.test.ts`
(dep-factory default only).

**Leaf report:** one leaf session (~10 min, 4 edits + 5 test/typecheck runs,
real-git throwaway repos under /tmp, rmSync-cleaned). No deviations from the brief.

**RED (observed by the leaf against the unchanged production code; dep field +
factories present so no construction failure):** `npm test -- src/queue.test.ts` →
3 failed / 31 passed:
1. once-per-acquisition spy count — `AssertionError: expected +0 to be 1`
   (production did not call the dep).
2. throwing refresh — `expected undefined to be an instance of
   QueueAcquisitionError`.
3. real-git stale clone (revert `Revert "fix crash (#1)"` committed to origin
   AFTER the clone; production `git log --format=%s origin/main` guard; real
   `git fetch --prune origin` refresh) — `AssertionError: expected [ 'gh-1' ] to
   deeply equal []` on `skippedMerged`: stale clone read the revert as absent →
   live issue skipped as merged. Exactly the planned pre-fix observation.
Leaf noted its first real-git run failed `spawnSync git ENOENT` from its own test
bug (rmSync in a non-async `.then` callback deleted the repo mid-flight); fixed
and not counted as RED.

**GREEN (leaf, then re-run fresh by the controller at `7d84b10`):** focused
`src/queue.test.ts` 34/34 exit 0; `npm run typecheck` exit 0; full `npm test`
10 files / 198 tests exit 0 (baseline 195 + exactly 3 new — full-suite green
proves no QueueDeps factory was missed).

**Reviews (fixed package base `a91e8a5` → candidate `7d84b10`, all four paths
accounted):**
- Specification review: **PASS**, zero blocking. Verified ordering
  (refresh strictly first, inside the acquisition try, before every signal
  read), message string verbatim with zero remaining pins of the old text,
  override path genuinely routes through `splitQueue` (src/loop.ts:1237) with no
  extra code, deleted-third-test note honored, scope clean.
- Code-quality review: **APPROVED**, zero critical/important blocking. Adjacent
  non-blocking observations recorded below; minor: `.then`-form vs await idiom
  in the real-git test (tolerated), duplicated `["fetch","--prune","origin"]`
  command string between test and production (deliberate seam isolation).

**Adjacent follow-ups (recorded, not fixed — routed to ticket 5 / backlog):**
- `syncMainToOrigin` (src/loop.ts) already runs `git fetch --prune origin`;
  ticket 5's consolidation may reuse the new seam.
- `splitQueue` docblock doesn't name the refresh step (the call-site comment
  does).
- Quality review: `stdio: "inherit"` on the production refresh prints fetch
  progress to the operator terminal and leaves the wrapped error message
  without stderr detail — consistent with neighboring `commentOnPr`/`closeIssue`
  wirings; revisit only if a test ever needs the reason in the message.
- Quality review: the raw `error.message` interpolation in
  `QueueAcquisitionError` reaches `console.error(error.stack)` without
  `assertNoSecrets` — byte-for-byte the pre-existing pattern of the message it
  replaces; no new emission point added by this diff.

**Evidence boundary / non-claims:** vitest unit + real-git clone evidence and
tsc only. The `main()` CLI wiring is typechecked but not executed end-to-end
against a live GitHub remote (no gh/network run) — integration evidence belongs
to a later pipeline task, recorded as a non-claim in verification.md.

---

## Task 2 — uncanaried-merge failure surface (FR-002, ticket 2)

- **Size:** medium (new `LoopOutcome.uncanaried` record + `QueueSummary`
  field + loud summary line + try/catch around `syncMain` in the auto-merge
  chain; tests across single-issue and queue modes).
- **Risk:** medium — modifies the WI-6 auto-merge chain tail (the same region
  canary/revert logic lives in); the outcome record must mirror `RevertedRecord`
  posture (no `prUrl` on the outcome). Confidentiality seam applies to the new
  PR-comment body (`assertNoSecrets` before `commentOnPr`).
- **Budget:** one leaf implementer session; vitest only, no Docker, no network.
- **Evidence boundary:** loop seam with a throwing `syncMain` dep; no canary
  result claimed for the uncanaried merge; no sync retry.
- **Fixed point:** `be5f210` (clean tree, T1 accepted).
- **Intended candidate:** working tree vs `be5f210`; commit message
  `feat(WI-7): uncanaried-merge failure surface — comment, summary line, halt, no blind revert (FR-002)`.

### Checkpoint record — ACCEPTED 2026-09-19

**Candidate:** `27abf15` (commit `feat(WI-7): uncanaried-merge failure surface —
comment, summary line, halt, no blind revert (FR-002)`), base `be5f210`.
Changed paths: `src/loop.ts`, `src/loop.test.ts` (the only two permitted).

**Leaf report:** one leaf session (~15 tool calls, ~5 min). No deviations.

**RED (leaf-observed against unchanged production):** the `syncMain` throw
propagated raw — `Error: divergent main` at `runSingleIssue src/loop.ts:775`;
queue tests `expected Error: divergent main to be an instance of
QueueAbortedError`; override path same raw throw via `runOverrideIssue
src/loop.ts:1244`. Exactly the predicted propagation.

**GREEN:** try/catch around `await deps.syncMain(...)` at the canary block's
start; shared `uncanariedDetail()` helper builds the line body once so the
outcome failure string, the queue tuple, and `formatSummary`'s
`⚠️ UNCANARIED MERGE` line agree byte-for-byte by construction;
`assertNoSecrets` before best-effort `commentOnPr` (inside the best-effort try,
sibling revert-comment idiom); `QueueSummary.uncanariedMerges` collected before
the abort throw; no CLI code changed (no-prUrl outcome rides the existing
guarded `Loop finished without a PR` path, exit 1). 4 new tests (i)–(l).

**Controller gate re-run fresh at `27abf15`:** focused `src/loop.test.ts`
94/94 (90+4); `npm run typecheck` exit 0; full `npm test` 10 files / 202 tests
(198+4) exit 0.

**Reviews (fixed package base `be5f210` → candidate `27abf15`):**
- Specification review: **PASS**, zero blocking. Verified outcome shape (no
  prUrl on the outcome), exact-pinned summary line, try/catch placement,
  secrets-guard idiom, no blind revert (revertMerge + canary sandbox
  unreachable), all four test scenarios, scope clean (auto-merge gating
  untouched — hard constraint 1 intact).
- Code-quality review: **APPROVED**, zero critical/important blocking.

**Adjacent follow-ups (recorded, not fixed):**
- `syncMainThrowsFor`/`commentThrowsFor` queue-harness knobs throw
  unconditionally when set (names/doc over-promise per-id filtering; the token
  in test (k) is decorative) — harmless in current tests; filter or reword if
  a future multi-issue test needs targeting.
- `commentNote` vocabulary drift between the reverted twin (bakes in
  `comment: `) and the new bare `posted`/`FAILED (…)` form — machine-comparable
  is arguably cleaner; alignment pass is ticket-5 territory if at all.
- Outcome `failure` string not exact-pinned (only `.toContain`) — matches house
  idiom; a one-line pin of the outcome side would be near-free.
- Uncanaried path deliberately does not @-mention `notifyHandle` (plan's line
  format omits it) — any uncanaried @-notification needs its own FR.
- The `⚠️ UNCANARIED MERGE` prefix is constructed at two call sites via the
  shared helper — consolidation candidate for ticket 5, same as the reverted
  path's analogous duplication.

**Evidence boundary / non-claims:** vitest public-seam suite + tsc only; the
sync failure is exercised via the LoopDeps seam (consistent with sibling
revert/canary testing). No Docker/pipeline-integration run of the uncanaried
path against a real repo.

---

## Task 3 — canary teardown failures never decide/erase the verdict (FR-003, ticket 3)

- **Size:** small-medium (own try/catch in the canary `finally`; optional
  `teardownFailure` on the green (MERGED-line suffix via grown `mergedPrs`
  tuple, parallel-field fallback allowed if tuple growth reads worse) and red
  (`RevertedRecord` field) paths; 2 new tests).
- **Risk:** medium — same code region as T2 (auto-merge chain tail); verdict
  preservation is the invariant (green stays merged, red still reverts);
  existing green/red canary tests must stay byte-unchanged; teardown failure
  never appended to the evidence string.
- **Budget:** one leaf implementer session; vitest only, no Docker.
- **Evidence boundary:** loop seam with throwing teardown deps; teardown not
  retried; leftover throwaway branches tolerated (next run's stale-branch
  pass) — not proven here.
- **Fixed point:** `0dcf132` (clean tree, T2 accepted).
- **Intended candidate:** working tree vs `0dcf132`; commit message
  `fix(WI-7): canary teardown failures recorded, never decide/erase the verdict (FR-003)`.

### Checkpoint record — ACCEPTED 2026-09-19

**Candidate:** `23f0a35` (commit `fix(WI-7): canary teardown failures recorded,
never decide/erase the verdict (FR-003)`), base `0dcf132`. Changed paths:
`src/loop.ts`, `src/loop.test.ts` (the only two permitted).

**Leaf report:** one leaf session (~25 min, ~14 tool calls, no API/Docker
spend). No deviations. Knobs: `canaryCloseThrows`/`canaryDeleteBranchThrows`
(makeDeps), `canaryCloseThrowsFor`/`canaryDeleteBranchThrowsFor`
(makeQueueDeps). Chose the `mergedPrs` tuple growth (4th element only when
present) over the parallel-field fallback — exactly one consumer
(`formatSummary`'s MERGED line) and the suffix lives on that same line.

**RED (leaf-observed; the plan required recording WHICH failure mode the
current tree exhibits):** neither flip nor propagation —
- green canary + `close()`-throw: `outcome.teardownFailure` assertion failed
  (`undefined and string is invalid for this assertion`) — the throw landed in
  the canary's outer catch, overwrote `canaryEvidence` (which the green path
  discards), and was SILENTLY SWALLOWED; merged outcome carried no note.
- red canary + throwing `deleteBranch`: `expected 'canary sandbox failed to
  run: git: branch -D refused — worktree busy' to contain
  'tests/test_contract.py::test_zero_contract'` — the base tree OVERWROTE the
  already-decided red evidence with the teardown error.
Both confirmed against base by the spec reviewer's independent static trace.

**GREEN:** own try/catch inside the canary `finally` (outer catch byte-unchanged,
now fires only on real run failures); close-then-delete ordering preserved;
green path conditional-spreads `teardownFailure` onto the merged outcome;
`RevertedRecord.teardownFailure` optional field (never appended to `evidence`);
MERGED line suffix `(canary: green; teardown: <reason>)`; REVERTED line suffix
`; teardown: <reason>`. 2 new tests (l)/(m).

**Existing canary tests byte-unchanged:** verified by the leaf
(`git diff -U0` — only 4 factory-wiring lines replaced, no existing
`it(...)` body/assertion/name edited) and independently by the spec reviewer
(all existing MERGED/REVERTED pins untouched and passing).

**Controller gate re-run fresh at `23f0a35`:** focused `src/loop.test.ts`
96/96 (94+2); `npm run typecheck` exit 0; full `npm test` 10 files / 204 tests
(202+2) exit 0.

**Reviews (fixed package base `0dcf132` → candidate `23f0a35`):**
- Specification review: **PASS**, zero blocking (verdict preservation, tuple
  growth, no parallel field, byte-unchanged existing tests, RED genuineness
  against base all verified).
- Code-quality review: **APPROVED**, zero critical/important. Confirmed
  confidentiality seam clean (teardown strings reach the terminal only via
  `formatSummary`'s guarded emit).

**Adjacent follow-ups (recorded, not fixed):**
- Single-issue `--issue` override path has no terminal surface for
  `teardownFailure` (queue summary + record only, per plan scope); possible
  doc tweak or sibling stderr line in a follow-up.
- Red-path PR comment names only the evidence, not the teardown failure —
  judgment call, plan-consistent.
- Preflight/verification sandboxes' teardown (`pre.close()` + `deleteBranch`
  in their `finally`, ~src/loop.ts:626) still propagates — same failure class,
  out of this slice's scope.
- `_branch` underscore prefix now read in both factory `deleteBranch` bodies —
  cosmetic.
- Knob match-strictness asymmetry (makeDeps prefix-match vs makeQueueDeps
  exact-match) — both correct in context.

**Evidence boundary / non-claims:** vitest unit seam + tsc only; no live
Docker/gh run of a teardown failure. Teardown is not retried; leftover
throwaway branches from a failed teardown are tolerated (next run's
stale-branch pass cleans them) — not proven here.

---

## Task 4 — negative-path test pins for wired guard behaviors (FR-004, ticket 4)

- **Size:** small (test-only slice, `src/loop.test.ts` only; no production
  change; expect +3 tests).
- **Risk:** low-medium — mutation checks temporarily edit production wiring
  (remove `assertNoSecrets` before `runReview`; remove the `finally` branch
  deletion) and must be restored exactly; pin 3 extends the real-git
  `syncMainToOrigin` describe.
- **Budget:** one leaf implementer session; vitest + real-git throwaway repos.
- **Evidence boundary:** pins existing wiring only, adds no new guard rules;
  pin 3 is a documented boundary-pin (stdlib git behavior — RED not
  constructible without mutating git itself).
- **Fixed point:** `436f47b` (clean tree, T3 accepted).
- **Intended candidate:** working tree vs `436f47b`; commit message
  `test(WI-7): pin guard wiring — secret-diff blocks review, throw-path deletion, divergent-base refusal (FR-004)`.

### Checkpoint record — ACCEPTED 2026-09-19

**Candidate:** `2bbca7d` (commit `test(WI-7): pin guard wiring — secret-diff
blocks review, throw-path deletion, divergent-base refusal (FR-004)`), base
`436f47b`. Changed path: `src/loop.test.ts` ONLY (+65/−1); `git diff` on
`src/loop.ts` empty (production untouched — restoration of the temporary
mutation edits proven by the committed diff).

**Leaf report:** one leaf session (~25 min, ~10 tool calls). One sanctioned
deviation: the plan's `readEnvFile` fixture parenthetical didn't match the
file (the actual sibling idiom is an inline `env: {...}` override — the seam
`deps.env` is exactly what the loop hands `assertNoSecrets`); followed the
real idiom. Added a `reviewDiff?: string` DepOverrides knob (no sibling
`fixDiff` override existed; default string unchanged so the approve-path
sibling pin still holds).

**Mutation check 1 (pin 1, secret-diff block):** mutation = removed
`assertNoSecrets([reviewPrompt], deps.env);` (+ its 2-line comment) before the
`runReview` call in `src/loop.ts`. Observed RED: `runReview` WAS called —
`Number of calls: 1` at `expect(deps.runReview).not.toHaveBeenCalled()`;
1 failed / 98 skipped. Restored via `git checkout -- src/loop.ts`; single
test re-run green. Statically re-confirmed by the spec reviewer against
`loop.ts:762-766` (the diff is embedded in `reviewPrompt` before the guard).

**Mutation check 2 (pin 2, throw-path deletion):** first attempt (removing the
whole `finally`) produced a PARSE ERROR — discarded as not a behavioral
mutation. Valid mutation = emptied the `finally` body (removed only the
`await deps.deleteBranch(input.repoDir, REVIEW_BRANCH);` line). Observed RED:
`deleteBranch` fired only for `loop/preflight-gh-1`, never `loop/review` —
assertion diff showed exactly that substitution; 1 failed / 98 skipped.
Restored via `git checkout`; re-run green.

**Pin 3 (boundary-pin):** divergent non-checked-out main → `syncMainToOrigin`
throws (`! [rejected] main -> main (non-fast-forward)` observed live), local
main never clobbered, HEAD unchanged. In-test comment documents the
boundary-pin status (the refusal is stock git behavior; no natural RED).
Quality-review nit recorded below on the comment's wording.

**Controller gate re-run fresh at `2bbca7d`:** focused `src/loop.test.ts`
99/99 (96+3); `npm run typecheck` exit 0; full `npm test` 10 files / 207 tests
(204+3) exit 0. `git diff src/loop.ts` = 0 lines.

**Reviews (fixed package base `436f47b` → candidate `2bbca7d`):**
- Specification review: **PASS**, zero blocking (all three pins verified
  against the real production wiring; knob assessed minimal; scope clean).
  Its one Unverified item — evidence-of-execution of the mutation checks —
  is closed by this record (mutations leave no repo trace by design).
- Code-quality review: **APPROVED**, zero critical/important. Confirmed the
  synthetic-secret hygiene (key-not-value on every surface) and the shared
  `REVIEW_BRANCH` import (no drifting literal).

**Adjacent follow-ups (recorded, not fixed):**
- Pin 2 overlaps the pre-existing "thrown review → uncertain" test except for
  the load-bearing `deleteBranch(REVIEW_BRANCH)` assertion; standalone pin
  sanctioned by the plan as its own mutation target.
- Pin 3's comment slightly overstates ("would require mutating git itself"):
  a forced refspec (`+main:main`) in OUR wiring would also turn it red.
  Comment-accuracy nit only.
- `makeQueueDeps`'s `fixDiff` mock cannot be overridden — a queue-seam
  secret-diff pin would need the same knob there.

**Evidence boundary / non-claims:** pins existing wiring only; no new guard
rules. Pins 1–2 pass on the unmutated tree BY DESIGN (already-wired
behavior); their justification is the recorded mutation checks. Pin 3 is a
boundary-pin. The secret is a synthetic in-test string; no `.env` value was
read, printed, or echoed.
