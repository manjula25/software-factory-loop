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
