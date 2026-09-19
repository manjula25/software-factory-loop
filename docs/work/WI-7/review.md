# WI-7 Code Review Record

Four-axis branch review per the `code-review` skill. Read-only axis reviewers ran in
parallel as isolated subagents (Explore agents, no write access); this controller
aggregated, classified findings, and resolved blockers.

## Identities

- **Fixed point:** `391d2de` (`main`, merge of PR #10)
- **Reviewed candidate:** `4065fc7` (branch `worktree-wi-7`, 18 commits ahead: planning
  chain b48456c…3ce0a0c, header normalization a91e8a5, 5 task commits + 5 evidence
  commits, completion verification 4065fc7)
- **Ancestry:** valid (`git merge-base` = fixed point; linear, no merges)
- **Resolution delta:** `22db046` (one commit after the reviewed candidate — the two
  blocking-finding fixes below; test-only + doc-only). Review verdicts apply to the
  reviewed range `391d2de...4065fc7`; the delta is separately accounted in
  **Blocking findings — resolution record**.

## Changed-path accounting (16 files, all inspected)

| Path | Axis coverage |
|---|---|
| `src/loop.ts` | all four axes (FR-002/003 behavior, FR-005 extraction, hard constraints) |
| `src/loop.test.ts` | all four axes (+12 tests incl. real-git describe extensions) |
| `src/queue.ts` | all four axes (FR-001 refresh, `covers`, `PR_PAGE_LIMIT`) |
| `src/queue.test.ts` | all four axes (+3 tests incl. real-git stale-clone) |
| `src/sandcastle-adapter.ts` | all four axes (exports only; boundary test file byte-unchanged) |
| `docs/work/WI-7/` (11 files: prd, slices, specification, plan, tickets 1–5, implementation-notes, verification) | axes 1–3 (traceability, evidence integrity) |

`src/onboard-profile.ts` untouched (`valuelessFlag` sanctioned stop — see axis 2
finding 2). No file outside `src/` + `docs/work/WI-7/` changed.

## Axis verdicts (separate, per skill)

### Axis 1 — Repository standards: PASS with one blocking finding (resolved)

All six hard constraints verified intact: constraint 1 untouched (auto-merge gating
unchanged, this repo still never auto-merges itself); 2 (fresh-sandbox verification)
unweakened — T2/T3 add failure surfaces, never trust substitutes; 3 (confidentiality)
— the new PR-comment body passes `assertNoSecrets` inside the best-effort try;
teardown strings reach the terminal only via `formatSummary`'s guarded emit; T4's
secret is a synthetic in-test fixture; 4 (repro tests stay) — no test deleted; 5/6
untouched. No lint exists; none invented. Commit discipline and evidence-record
conventions followed.

**Blocking:** CLAUDE.md's "What is built so far" module table was not updated despite
its own rule ("if you add a surface, say so here in the same PR that adds it") — WI-7
added `QueueDeps.refreshRemoteRefs`, the uncanaried outcome/summary surface, and
teardown bookkeeping, but zero WI-7 mentions existed. **Resolved** at `22db046`
(doc-only: `src/loop.ts` and `src/queue.ts` rows updated).

### Axis 2 — Specification fidelity: PASS (no blocking)

All five FRs verified implemented at the right seams against
`docs/work/WI-7/specification.md`: FR-001 refresh awaited first in `splitQueue`
before every dedup signal, override path inherits via the same `splitQueue`; FR-002
guarded comment + `failureKind: "harness"` halt + no blind revert + shared
`uncanariedDetail`; FR-003 verdict preservation (the actual base defect — a
propagating close()-throw overwrote `canaryEvidence` — is fixed and pinned both
paths); FR-004 all three pins at the right seams; FR-005 refactor with exactly one
assertion-touching line (the sanctioned rename). No scope creep against the
carve-out's explicit out-of-scope list.

Adjacent (non-blocking):
1. **Deleted-branch-prune fixture absent** — reconciled: the plan's own ponytail pass
   (3ce0a0c) deleted that test as vacuous (production branch listing uses
   `git ls-remote`, a live remote query that never reads tracking refs). Recorded in
   the plan; spec's "both proven by real-git seam tests" text overstates — see
   follow-up 2 below.
2. **`valuelessFlag` spec text unmet** — reconciled: sanctioned stop (only 2
   occurrences, the spec/plan's n=3 premise was wrong); recorded in verification.md
   and implementation-notes.md. Follow-up: amend the specification text (owner:
   future docs pass), not force the code.
3. Minimal-surface growth (`mergedPrs` 4-tuple, acquisition message reword) — judged
   the smallest honest surfaces for "recorded loudly"/"loud, named"; no action.

Unverified-closed: axis 2 could not run the gates itself; the controller's fresh runs
stand — 4065fc7-era verification (10 files / 207, typecheck 0) and post-fix gates at
`22db046` (`src/loop.test.ts` 99/99, typecheck exit 0, full suite 10 files / 207).

### Axis 3 — Evidence and risk integrity: SOUND (no blocking)

Per-task RED/GREEN records verbatim and candidate-pinned; mutation checks for pins
1–2 recorded (execution-by-record is the designed limit — mutations leave no repo
trace); T5's byte-green criterion honestly scoped as non-behavioral proof; non-claims
explicit (no pipeline-integration run; `main()` wiring typechecked-only). The
fresh-gate staleness between f868771 and 4065fc7 judged immaterial (docs-only commit;
gates re-run at 22db046 regardless).

Adjacent (non-blocking): T2 verification lettering nit ("(i)–(l)" spans T3's test);
"remaining risks: none" marginally stronger than the recorded
`QueueAcquisitionError` raw-message residual (suggest a confidentiality-residual
line next time); pin-3 comment overstatement already noted in
implementation-notes.md. All recorded, none material.

### Axis 4 — Unnecessary complexity: PASS with one blocking finding (resolved)

Checked clean: the `runPreMergeReview`/`runCanary` extraction is pure relocation
with a minimal discriminated return; `covers`, `BoundedRunOptions`, `advanceUpstream`,
`CANARY_RED_SUITE`, `PR_PAGE_LIMIT`, and the `refreshRemoteRefs` wiring are all
dedup or FR-mandated; no speculative generality; heavy doc comments match house
idiom.

**Blocking:** `syncMainThrowsFor`/`commentThrowsFor` in `makeQueueDeps` threw
unconditionally, contradicting their own doc comments and every sibling knob's
per-target matching — test (j)'s "gh-2 never ran" assertion was pinned by luck.
**Resolved** at `22db046` (test-only: `syncMain` now matches `active.id`;
`commentOnPr` now matches the PR-URL token, mirroring `mergeThrowsFor`).

Adjacent (judgment calls, recorded to follow-up backlog): `runCanary`'s derivable
`prUrl`/`attachmentFailures` params; conditional 4-tuple push could be a plain
optional-element push; `uncanariedMerges` pre-rendered string vs `RevertedRecord`'s
structured shape; `commentNote` vocabulary drift between the reverted/uncanaried
comment paths; duplicated divergent-main setup in the FR-004 pin test (a
`divergeLocal()` companion to `advanceUpstream` would finish the job).

## Blocking findings — resolution record

Both blockers fixed in `22db046` (test-only + doc-only; no production `src/` file
touched — `git show 22db046 --stat`: `src/loop.test.ts` + `CLAUDE.md`). Gates re-run
fresh by the controller at `22db046`: focused `src/loop.test.ts` 99/99 exit 0;
`npm run typecheck` exit 0; full `npm test` 10 files / 207 tests exit 0. Because the
delta contains zero production behavior and zero assertion edits (two mock guards + a
doc comment in the factory + two CLAUDE.md table rows), the four axis verdicts over
`391d2de...4065fc7` carry forward; the delta is fully described above and re-running
all four axes over it would re-review the identical production code.

## Follow-up backlog (adjacent findings, no silent scope expansion)

Deferred with owner (future work item), unless noted:
- Amend specification.md FR-005 text for the `valuelessFlag` premise correction and
  FR-001's "both proven" wording (docs pass).
- `runCanary` derivable-param shrink; conditional-push simplification;
  `uncanariedMerges` record shape; `commentNote` shared helper; `divergeLocal()`
  test companion (axis 4 judgment calls).
- Carried from implementation-notes: `syncMainToOrigin` reuse of the refresh seam;
  preflight/verification sandbox teardown propagation; override-path
  `teardownFailure` line; uncanaried @-notification (needs own FR); test-knob naming
  nits; WI-6 carried items (revert-matcher permanence, skipped-merged cosmetic).

## Aggregate

Four separate verdicts at `391d2de...4065fc7`: standards PASS (1 blocker resolved),
specification PASS (0 blockers, 3 adjacent), evidence SOUND (0 blockers, 3 adjacent),
complexity PASS (1 blocker resolved, 5 adjacent). Both blockers resolved at `22db046`
with fresh green gates; no unverified gaps remain open. Review complete for the exact
candidate; next step `finishing-a-development-branch` (delivery actions only on
explicit authorization).
