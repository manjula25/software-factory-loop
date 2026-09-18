# WI-3b Code Review — two-axis, branch-level

Fixed point `f53be15` (main at WI-3 merge); diff `f53be15...HEAD`; final head
at review time `a578f40` (code identity `d60e041`; commits above it docs-only).
Code commits: `d27f2cf` (nesting guard), `02e8064` (`--` slug separator),
`d60e041` (onboarding fresh fork + green-repo acceptance). Spec source: the
accepted briefs in `implementation-notes.md` (WI-3b has no formal
specification) + the FR-005/006 revision note in `docs/work/WI-3/specification.md`.

Both axes ran as parallel read-only sub-agents; reports aggregated verbatim
below, not merged or re-ranked.

## Standards

Hard violations (documented standards): **none found**.

- Only `src/sandcastle-adapter.ts` imports `@ai-hero/sandcastle`;
  `scripts/onboard.ts` imports the adapter, respecting the boundary (CLAUDE.md
  module table).
- No lint invented; no command changed, so `docs/agents/workflow.md`
  correctly untouched.
- No auto-merge, no cloud sandbox, no confidentiality regression: the new
  guard runs before any sandbox/agent spend and emits no client data.

Judgement calls:

1. CLAUDE.md honesty rule ("if you add a surface, say so here in the same PR
   that adds it") — `src/onboard-profile.ts` gains a new exported surface,
   `parseSuiteBaseline` + `SuiteDidNotRunError`, a stretch beyond the table's
   "Onboarding argv parsing + project-profile shaping". Soft breach; one
   clause in that row would fix it. → **RESOLVED post-review**: the row now
   reads "…incl. the clearance flag, and suite-baseline parsing
   (`parseSuiteBaseline`) (WI-3b)". Docs-only edit; code identity `d60e041`
   unchanged.
2. Duplicated Code — the collision-counter shape is duplicated with an
   identical three-line comment in `parseSpecDoc` and `parsePlainList`
   (`spec-${slug}--${count}` vs the `list-` twin, plus the twin "slugify
   output can never contain `--`" comments). A shared
   `dedupedId(prefix, slug, count)` in `src/issues.ts` would keep the
   invariant documented once. → matches the WI-3 follow-up queue's
   slug-dedup extraction item; not addressed here (recorded follow-up).
3. Speculative Generality (mild) — `pathCommittedOnBranch(repoDir, branch,
   path)` only ever called with `"main"` and `".loop-harness"`. Defensible as
   a `LoopDeps` injection seam for the tests; not worth changing.
4. Mysterious Name (very mild) — `SUMMARY_TOKEN` names a regex pattern, not a
   token; `SUMMARY_PATTERN` would read truer. Cosmetic; queued.

Conventions followed well: `SuiteDidNotRunError` sets `name` and carries a
diagnostic message matching sibling errors; `execFileSync`-in-async matches
the existing `deleteBranch`/`createPr` style; evidence-style comments match
repo voice; the catch-with-comment on absent branch matches the existing
pattern. Docs commits are `docs/work/` evidence plus a dated revision note in
the WI-3 spec that points at WI-3b notes rather than silently rewriting the
FR — acceptable as a traceability artifact.

**Axis summary: 0 hard violations; worst item = the CLAUDE.md table clause
(resolved).**

## Spec

Missing or partial — none blocking. All four intended behaviors present and
tested at the right seams:

1. Nesting guard (`src/loop.ts:327-343`): gated on `staged.length > 0`,
   `pathCommittedOnBranch(repoDir, "main", ".loop-harness")` via ls-tree,
   failureKind `"harness"` → queue aborts; message names root cause +
   `git rm -r --cached` remediation; tests pin createFixSandbox/runFixRun/
   createPr never called. Matches brief item 1.
2. `--N` separator in both parsers (`src/issues.ts:95`, `:148`); slugify
   collapses runs to one `-`, so distinctness holds by construction;
   collision tests added for both parsers; dedup's `escapeRegExp`+`\b`
   handles `--` ids. Matches brief item 2 and the FR-005/006 revision note.
3. Fresh fork (`scripts/onboard.ts:26-32`): best-effort
   `git branch -D loop/onboard` before createFixSandbox with the
   observed-staleness comment. Matches brief (B).
4. Green-repo acceptance: `parseSuiteBaseline` throws
   `SuiteDidNotRunError` only when no summary token; green → `[]`. Matches
   brief (A).

Minor partial, already on record (follow-up 1): "zero spend" holds for
sandbox/agent, but the guard sits after `fetchAndStageAttachment`, so a
doomed run still performs the network fetch — the brief itself specified the
`staged.length > 0` gating, so this conforms; record-only.

Scope creep — none unsanctioned; all three fold-ins explicitly sanctioned in
implementation-notes.

Implemented but questionable — one minor: `SUMMARY_TOKEN`
(`src/onboard-profile.ts:23`) accepts `skipped|xfailed|xpassed|errors` as
execution evidence, while the verification gate's `SUITE_SUMMARY_RE`
(`src/loop.ts:156`) accepts only `passed|failed|error`. A suite reporting
only "4 skipped in 0.01s" onboards with an empty baseline, yet every later
verification of that repo is rejected as unreadable — the two seams disagree
on what counts as a summary. Interpretation choice, not a violation; queued
as follow-up 8 (consistent with follow-up 6's direction of unifying
suite-output parsing).

**Axis summary: PASS — 0 blocking findings; 1 minor queued.**

## Overall

No blocking findings on either axis → no return to stage 3. Post-review
actions: CLAUDE.md module-table clause (done, docs-only); follow-up queue
additions 8–9 recorded in implementation-notes.
