# WI-6 Code Review (two-axis, `code-review` skill)

- **Fixed point:** `main` (`3064cef`), diff `git diff 3064cef...HEAD` (three-dot).
- **Candidate at review time:** `710384b` (final completion verification). 31 files,
  +4050/−45, 16 commits (T1–T7 + T4b defect fixes + verification records).
- **Spec source:** `docs/work/WI-6/specification.md`; product-level questions resolve
  against `harness-prd-v2.md` / `docs/work/WI-6/prd.md`.
- **Standards sources:** `CLAUDE.md` (hard constraints, module table, lifecycle),
  `docs/agents/workflow.md` (Repository commands, Secrets), plus the skill's fixed
  Fowler smell baseline.
- Both axes ran as parallel read-only sub-agents; reports below are their findings,
  not reranked across axes.

## Standards

*(as reported by the Standards sub-agent)*

1. **Secrets seam gap (hard, pre-existing line made material by WI-6)** —
   `src/loop.ts`, the `--issue` override path: `console.error(\`Loop finished
   without a PR — ${result.outcome.failure}\`)` emitted without `assertNoSecrets`.
   WI-6 newly routes subprocess error text into `failure` (revert path quotes
   `canary sandbox failed to run: …`, `revertFailure`, `commentNote`). Queue mode
   guards the same content (`emit` in `main()`). Violates CLAUDE.md's
   "confidentiality seam every emitted string passes through" and workflow.md
   Secrets. *(Previously recorded as T3 follow-up #3; elevated to blocking here
   because WI-6 made the string class richer.)*
2. **Module-table honesty (minor)** — `CLAUDE.md`'s `src/queue.ts` row said "dedup
   against open PRs and stale branches"; the file now also owns merged-PR dedup and
   the revert guard.
3. All six hard constraints otherwise check out; no lint invented; workflow.md
   command list current.

Judgement calls (non-blocking): unused `diff` field on the `runReview` seam input
(Speculative Generality); canary new-failure filter duplicates `diffVerification`'s
shape; `error instanceof Error ? …` idiom ~10×; `{repoDir, prUrl}` data clump;
~200-line inline auto-merge chain (suppressed — CLAUDE.md module table assigns it
to `loop.ts`).

## Spec

*(as reported by the Spec sub-agent)*

**(a) Missing/partial — none material.** FR-001…FR-010 all present.

**(b) Deviations:**
1. `syncMainToOrigin` replaces plan-D3's literal `git fetch origin main:main` —
   documented T4b defect fix (checked-out main); intent (loud refusal on
   divergence, pre-canary) preserved.
2. The summary line gains `| skipped-merged: N` on non-opted repos too — cosmetic
   tension with the opted-out byte-identity pin; the merged-dedup itself is
   FR-002-mandated source-agnostically.

**(c) Looks wrong:**
1. `mainRevertsPr` reads local `origin/main` with no fetch at acquisition time — a
   stale clone can misjudge re-queue (FR-006). *(Already recorded: T4 follow-up #5,
   T7 follow-up.)*
2. `splitQueue` consults `mainRevertsPr` only for the FIRST covering merged PR.
3. The revert matcher marks a PR reverted forever even after a human re-merges the
   same fix (spec-silent).

**Per-axis summary — Standards: 2 actionable (worst: the unguarded emission on the
override path). Spec: 0 blocking, 3 notes (worst: `mainRevertsPr` staleness edge
in the re-queue rule).**

## Controller triage and resolution

| Finding | Verdict | Action |
|---|---|---|
| Standards 1 — unguarded `Loop finished without a PR` | **Blocking** | **Fixed (this commit):** the line now passes `assertNoSecrets` like its siblings (`mergeFailure`/`closeFailure` lines); mirrors queue mode's `emit` guard. Closes T3 follow-up #3. |
| Standards 2 — stale queue.ts module row | **Blocking (CLAUDE.md honesty rule: same PR)** | **Fixed (this commit):** row now names merged-PR dedup + revert re-queue guard + review-verdict parsing. |
| Spec (b)1 syncMain deviation | Documented, sanctioned (T4b) | None — recorded in implementation-notes and verification. |
| Spec (b)2 `skipped-merged` on non-opted repos | Cosmetic tension only | Recorded here; dedup is FR-002-mandated source-agnostically; the byte-identity pins cover the PR body/merge machinery, not the queue summary. |
| Spec (c)1 `mainRevertsPr` no fetch | Deferred | Stays a recorded follow-up (T4 #5 / T7). Effect: a run on a clone whose `origin/main` tracking ref predates a revert can wrongly skip a reverted issue until any fetch refreshes it (`syncMainToOrigin` prunes+fetches after every successful auto-merge). Owner: pre-delivery cosmetics batch. |
| Spec (c)2 first-covering-PR only | Not blocking | Analysis: the reviewer's "wrongly skipped" direction cannot occur via this mechanism — if ANY covering PR is merged and not reverted, main genuinely has the fix, so skip is correct; if the first is reverted, the issue becomes eligible regardless of later covering PRs. The possible wrong direction is the opposite (eligible when a later merged PR already fixed it → a duplicate fix attempt, which degrades to "no commits", not silent loss). Recorded as a note; no action. |
| Spec (c)3 revert matcher permanence after human re-merge | Spec-silent | Recorded as a note for a future work item (matcher could bound itself to commits after the revert). |
| Standards judgement calls (`diff` field, dedup extraction, error idiom, data clump) | Judgement calls | Join the recorded pre-delivery cosmetics batch (implementation-notes follow-ups). |

**Candidate after fixes:** HEAD of this commit. Fresh verification on the changed
candidate: `npm run typecheck` exit 0; `npm test` 10 files / 195 tests, exit 0
(recorded in `verification.md`). No behavioral change (a guard call and a docs row),
so the spec axis is unaffected; the standards fixes were verified by controller
inspection against their sibling lines plus the fresh suite.

No blocking findings remain. Per the lifecycle: ready for
`finishing-a-development-branch`.
