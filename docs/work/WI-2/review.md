# WI-2 Code Review

## Candidate identity

- Fixed point: `847ba3b264679ec25e9ee123335e3c77e21eecd0` (`main`)
- Candidate: `5d8edbcf4baf5a48289cd760f44bd57a572d1e8c` (`worktree-wi-2` HEAD)
- Ancestry valid, range non-empty (8 commits).
- Note on evidence freshness: `docs/work/WI-2/verification.md` records evidence for
  `cdc6439`; the only commit after that (`5d8edbc`) adds the verification document
  itself — no source, test, or manifest change (`git diff --stat cdc6439..5d8edbc` is
  that one file). The recorded evidence therefore still applies to the candidate.

## Changed-path accounting (21 paths, all inspected)

- Source (5): `src/queue.ts` (new), `src/queue.test.ts` (new), `src/loop.ts` (queue
  runner + CLI widening), `src/loop.test.ts` (9 new cases), `src/sandcastle-adapter.ts`
  (`runTriage` export).
- Manifest (2): `package.json`, `package-lock.json` (zod `^4.6.5` direct dependency,
  decision 15).
- Repo docs (2): `docs/agents/workflow.md` (new CLI surface), `harness-prd-v2.md`
  (owner-directed amendments to 2026-09-15 decisions 2 and 4).
- Work-item artifacts (12): prd, slices, specification, 5 tickets, implementation plan,
  3 evidence logs, verification record.

## Axis 1 — Repository standards: PASS

- All six hard constraints hold: no auto-merge anywhere (PRs are opened and left for
  humans; `mergeBack()` remains unused by the flow); verification is unchanged WI-1
  fresh-sandbox re-run (`runSingleIssue` reused verbatim); no client repo touched —
  all live evidence is the seeded fixtures repo; cap enforced before any spend
  (`parseCap` at flag-parse time); local Docker only.
- Secrets: the three new emitted strings (triage prompt, degrade warning, run summary)
  all pass `assertNoSecrets`; evidence logs scanned against `.env` values — clean.
- Adapter boundary intact: `@ai-hero/sandcastle` imported only by
  `sandcastle-adapter.ts`; boundary test suite passes (3/3).
- Commit style, comment density, `readonly` discipline, and `.js` import suffixes match
  the surrounding code; every commit carries the attribution trailer.

## Axis 2 — Specification fidelity: PASS

Every FR traced to implementation and test:

- FR-001: `listOpenIssues` (bounded page `--limit 30`, optional `--label`, empty ≠
  failure via distinct `QueueAcquisitionError`). T1 tests 3/3.
- FR-002: `splitQueue` — head-branch equality or exact-token body match (`\bgh-N\b`:
  the `gh-1` vs `gh-11` test passes), stale branch deleted locally (reused
  `LoopDeps.deleteBranch`) and remotely, issue stays eligible; listing failure aborts
  pre-spend. T2 tests 3/3.
- FR-003: `admitIssues` + `parseTriageOutput` — deterministic default with no model
  call; `--triage` ranks by Zod-validated scores with file-overlap deferral (decision
  14) reporting the owning issue; unusable output degrades loudly; cap validated at
  startup. Criteria (a)–(g) each map to a passing test.
- FR-004: `runQueue` — sequential (the max-concurrent-sandboxes test asserts 1);
  issue-level failure continues; stale-baseline abort propagates as a thrown
  harness-level error with no summary. Live runs (b)/(c) exhibit both admission paths.
- FR-005: `formatSummary` — counts, per-failure and per-not-admitted lines with
  reasons, PR URLs; secrets-guarded; abort path prints no summary.
- FR-006: three live runs recorded with post-run state verification in
  `docs/work/WI-2/evidence/`.

## Axis 3 — Evidence and risk integrity: PASS

- Verification record is fresh for a source-identical candidate (see identity note).
- The live-run identity argument is honest: source unchanged from `9356865` through
  HEAD except evidence/verification documents.
- Non-claims are explicit and accurate (degrade path and deferral are unit-proven only;
  one live datapoint each for triage validity and cap-forcing).
- The PRs the runs opened (#8, #9) were merged by the owner after review — the harness
  never merged anything itself.

## Axis 4 — Unnecessary complexity: PASS with findings

No blocking complexity. Three small findings, all non-blocking:

### Findings

1. **[adjacent / simplification]** `src/queue.ts` `admitIssues` — the `degraded`
   expression `triageUnusable === true || (triage !== undefined && !useTriage)` has a
   redundant second disjunct: `useTriage` is false exactly when `triageUnusable` is
   true, so the first clause already covers every case the second could. Replace with
   `degraded: input.triageUnusable === true`. No behavior change; tests stay green
   either way.
2. **[adjacent / robustness]** `src/loop.ts` `runQueue` classifies a harness-level
   abort by matching the failure-string prefix `"Aborted before the fix run"` — a
   string coupling to `runSingleIssue`'s message. If that message is ever reworded,
   stale-baseline aborts would silently degrade to issue-level failures (queue would
   grind through every issue instead of aborting). Smaller hardening when next touched:
   a typed `kind` on `LoopOutcome` failures. Not blocking: the coupling is covered by a
   test that fails if the prefix changes, and both strings live in the same file's
   orbit.
3. **[adjacent / consistency]** exit codes: queue mode exits 0 even when some issues
   failed (the summary is the deliverable; aborts throw and exit non-zero), while
   single-issue mode exits 1 on failure. Defensible reading of FR-005, recorded here so
   the choice is deliberate and visible rather than accidental.

### Unverified evidence

None — every claim above maps to a test, a fresh command output in `verification.md`,
or a live-run log.

## Verdict

**No blocking findings.** All four axes pass; the three adjacent findings are recorded
for a future touch, none weaken a protected seam. The candidate is ready for
`finishing-a-development-branch` upon owner authorization.

## Post-review follow-up (owner-directed fix of the open items, same day)

The owner directed the open items be fixed before delivery. Fix commit:
`ecbaed8a0079779ac6a302999e68b9d01ffaa902` (`ecbaed8`), exactly 2 files changed
(`src/loop.ts`, `src/queue.ts`, +13/−3).

- **Finding 1 (resolved):** `admitIssues` now returns `degraded:
  input.triageUnusable === true`; the redundant disjunct is gone. The degrade-warning
  unit test still passes — behavior unchanged.
- **Finding 2 (resolved):** `LoopOutcome` carries a typed `failureKind?: "harness"`,
  set on the stale-baseline preflight return; `runQueue` branches on that field, not
  on the `"Aborted before the fix run"` string prefix. The queue-abort unit test
  (which stubs the real `runSingleIssue` path) passes through the typed field, so the
  string coupling is fully removed.
- **Finding 3 (kept as recorded choice):** queue-mode exit 0 on mixed outcomes
  remains, deliberately — the summary is the deliverable; harness-level aborts throw
  and exit non-zero. No change.

Re-verification at `ecbaed8`: `npm test` 59/59 exit 0, `npm run typecheck` clean
(recorded in `verification.md`). The four axis verdicts above were re-checked against
the delta diff — no axis is affected by a typed discriminator and a simplified
boolean. Verdict stands for `ecbaed8`; candidate ready for
`finishing-a-development-branch` upon owner authorization.

---

## Incremental review — trial tail (`origin/main..a567b40`, 2026-09-16)

Candidate: `worktree-wi-2-trial` @ `a567b40` (4 commits: `e7560d0` onboard
`--install`/`--test`, `3290e2d` `--single-test`, `f30c745` handoff doc, `a567b40`
trial evidence). Fixed point: `origin/main` @ `883adaf` (PR #4's original range already
merged). Ancestry verified (`git merge-base --is-ancestor`, exit 0); range non-empty.

**Changed-path accounting (6 files, +280/−4, all inspected):**

| Path | Axis relevance |
|---|---|
| `scripts/onboard.ts` (+20/−4) | code — the only source change |
| `docs/work/WI-2/handoff-magvation-trial-2026-09-15.md` | evidence/planning docs |
| `docs/work/WI-2/magvation-trial-2026-09-16.md` | evidence record (this trial) |
| `docs/work/WI-2/evidence/magvation-run-{smoke-gh-1,queue-gh2-gh3}.log` | raw run summaries |
| `docs/work/WI-2/verification.md` (+5) | pointer to the trial record |

**Axis verdicts:**

- **Repository standards — pass.** `optValue` matches the script's existing
  plain-argv idiom; header comment updated to document the flags; typecheck clean;
  72/72 unit tests fresh at `a567b40`.
- **Specification fidelity — unverified (no FR).** The flags were trial-driven
  enablers, not a specced FR; the WI-2 specification says nothing about them.
  Documented honestly in the handoff and trial record instead. The PRD's
  run-don't-trust rule is preserved: an overridden install/test command still lands
  in the profile only by executing successfully — the flags override the *choice* of
  command, not the execution gate.
- **Evidence and risk integrity — pass.** The two evidence logs are verbatim run
  summaries; a secret-pattern scan of the full range diff (`token|secret|api key|
  password|gho_|sk-`) matches nothing. magvation is a confidentiality-cleared repo
  (2026-09-15), and its name already appears in merged docs. The trial record states
  explicit non-claims (harness-own verification evidence, no human review of PR
  content, unexercised paths).
- **Unnecessary complexity — pass.** Three `?? default` lines and one 3-line helper;
  no abstraction added.

**Adjacent observations (non-blocking):**

1. A flag passed without a value (e.g. `--install` as the last arg) silently falls
   back to the default rather than erroring; the recorded profile shows the command
   actually used, so the failure is visible after the fact but not at input time.
2. Flags are positional (`argv[2]` must be the repo dir) per the usage line; a flag
   first would be misread as the repo dir. Pre-existing parsing style, documented.
3. The evidence logs live in `docs/` rather than being summarized — deliberate
   (durable output references per the verification skill), same convention as
   `evidence/run-a..d.log`.

**Verdict: no blocking findings.** Ready for `finishing-a-development-branch` with
owner authorization (given: push `a567b40` to `origin/worktree-wi-2`, open PR for the
4-commit tail vs `main`, merge on approval).
