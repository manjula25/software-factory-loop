# WI-4 Code Review — two-axis, branch-level

Fixed point `ce763cd` (main at PR #7 merge); diff `ce763cd...HEAD`; head at
review time `6f474d8` (code identities `7687e9d`, `27421a6`, `0990db8`;
commits above them docs-only). Spec source: the accepted briefs in
`implementation-notes.md` (WI-4 has no formal specification) + the WI-3b
follow-up queue items 1, 4, 6, 8, 9.

Both axes ran as parallel read-only sub-agents; reports aggregated verbatim
below, not merged or re-ranked.

## Standards

Hard violations of documented standards: **none found**.

- CLAUDE.md "if you add a surface, say so here in the same PR": the new
  shared export `SUITE_SUMMARY_RE` is added to the `src/verify.ts`
  module-table row in this same diff. Compliant.
- Sandcastle import boundary intact; no lint invented; no commands changed
  in docs/agents/workflow.md (none needed — preflight-check is
  typecheck-covered via tsconfig `include: ["src","scripts"]`).
- Hard constraints unaffected; budget cap untouched — the T1 move makes
  spend strictly smaller (guard fires before fetch/sandbox/agent).
- Tests at the public seam (`runSingleIssue`, `parseSuiteBaseline`,
  exported regex) — no source-text assertions.
- preflight-check dropping the hardcoded macOS path for a required argv
  aligns with the repo-boundaries hygiene in CLAUDE.md.

Baseline smells (all judgement calls, none blocking):

1. *Duplicated Code — removed, good.* Two of three near-identical summary
   regexes deleted in favor of one exported definition in verify.ts.
2. *Divergent Change — mild.* verify.ts is documented as "the verification
   gate" but now also owns the canonical execution-evidence definition
   consumed by onboarding and preflight; the CLAUDE.md row update papers
   over this. A tiny shared module would keep verify.ts single-purpose.
   Acceptable as-is given the documented update.
3. *Semantic widening flagged against hard constraint 2's spirit.*
   `parseSuiteOrReject` previously required `passed|failed|error`; it now
   accepts `skipped|xfailed|xpassed`. A verification suite reporting only
   "4 skipped" reads as readable with zero failures → verification passes
   without any test actually executing. Tested and documented as
   intentional, but it slightly weakens "an agent's 'done' is never
   evidence."
4. scripts/onboard.ts probe-then-unguarded-delete shape: idiomatic, no
   smell.

**Axis summary: 0 hard violations; worst item = the skipped-only widening
(item 3).**

### Controller response to item 3

Recorded, not dismissed. Counter-analysis on record: (a) the repro-test
gate is independent of `parseSuiteOrReject` and unchanged — a skipped-only
full suite cannot carry a passing repro run with it; (b) the widening only
adits outputs whose ONLY counted tokens are skipped/xfailed/xpassed — a
pathological post-fix state that previously surfaced as an "unreadable"
misdiagnosis of an already-lost run, while the REAL observed bug (WI-3b
queue item 8) was the reverse disagreement: onboarding accepting output the
gate rejected; (c) "N errors" output was already admitted pre-change via
the old regex's prefix match. Queued as follow-up 8: if a real repo ever
produces a skipped-only verification suite, require at least one
`passed|failed|error` token at the gate seam specifically (one-line
narrower test at that seam), rather than diverging the definitions again.

## Spec

Missing or partial requirements: **none**.

- T1: guard sits above the fetch loop, gated on
  `attachmentUrls.length > 0`; old block deleted; failure message and
  `failureKind` byte-identical; zero-side-effect refusal pinned at the
  public seam (fetchMock never called, no sandbox/agent/PR, no staged
  dir).
- T2: probe + unguarded delete; probe-only try/catch is the accepted
  deviation on record; absent → no-op; surviving branch → throw kills the
  script.
- T3: `SUITE_SUMMARY_RE` defined once in verify.ts, exported, consumed by
  all three seams; `SUMMARY_TOKEN` gone (grep-verified); preflight gets
  both promised extras (execution-evidence guard, argv repoDir with usage
  throw).

Scope creep: nothing unaccounted — the two adjacent touches (dropped
`summary line present` log; CLAUDE.md row) are each in-spec or
repo-mandated and on record. Implemented-but-wrong: none found; deferred
items verified NOT implemented (scope discipline held: no `main`-pairing
change, no `*-2` artifact cleanup, no cosmetics, deselected-only decision
correctly absent).

**Axis summary: PASS — 0 blocking findings.**

## Overall

No blocking findings on either axis → no return to stage 3. Follow-ups 8
(skipped-only gate narrowing trigger) and 9 (verify.ts single-purposeness,
record-only) added to the queue in implementation-notes.
