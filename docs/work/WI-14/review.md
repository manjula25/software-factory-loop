# WI-14 Code Review

- **Fixed point:** `ef8d52eb05a3e1dc23030443641b0e807f9f9ae8` (main; verified = merge-base)
- **Candidate:** `f4b029dd3ca2816caaa92eaea21abc5f617366c9` (HEAD, `worktree-wi-14`)
- **Source identity:** `785a026c1baaac76b45bdcd0bcdd9cfc12aaf0c6` — one docs-only commit
  (`f4b029d`, the verification record) sits after it, so the reviewed source is byte-identical
  to the source the T5 live runs exercised (`git diff --stat e07584e..HEAD -- src/` is empty).
- **Range:** 15 commits, non-empty (`git diff ef8d52e...f4b029d`); working tree clean
- **Spec:** `docs/work/WI-14/specification.md` (FR-001..FR-006), read as amended by the owner
  2026-09-23 (`7df0921`, plan interpretation note 1 — removal widened to every
  verified-PR-delivered outcome)
- **Method:** two read-only sub-agents in parallel (Standards, Spec); every finding the
  controller could act on was independently verified in `src/loop.ts` before classification
  below (see **Controller verification**, where one finding is dismissed and one is narrowed).

## Changed-path accounting (8 files)

| Path | Role |
|---|---|
| `src/loop.ts` (+328/−6) | The escalation surface: `buildEscalationComment`, `escalateOnFailure`, `ensureHarnessFailedLabel`, `removeHarnessFailedLabel`, the trigger wiring at the `fail()` family and the `preflight-failed` return, the removal wiring at the six delivered returns, and the summary/report renderers (T1–T3b) |
| `src/loop.test.ts` (+546/−1) | 22 tests across four describe blocks — FR-001..FR-005 at the public seam (T1–T3b) |
| `CLAUDE.md` (+3/−1) | `src/loop.ts` module row extended for WI-14; two `## Lessons` bullets (T4, then the post-T4 self-learning edits) |
| `docs/agents/workflow.md` (+1/−1) | Command-row honesty for the escalation surface (T4, FR-006) |
| `docs/work/WI-14/implementation-plan.md` (+21/−5) | Interpretation note 1 as amended; T5 steps |
| `docs/work/WI-14/implementation-notes.md` (+306) | Ledger, per-checkpoint evidence, deferred findings A1–A17 |
| `docs/work/WI-14/evidence/escalation-live-run.log` (+368) | T5: three runs, verbatim console + GitHub state, incl. the invalid first seed |
| `docs/work/WI-14/verification.md` (+171) | Completion record: gates, FR→evidence map, unknowns, non-claims |

Every changed path inspected by at least one axis; both `src/` files by both axes.

**Disclosed scope:** the two `## Lessons` bullets in `CLAUDE.md` landed *after* T4's review
(commit `785a026`), beyond the row T4 was reviewed against. The row itself is byte-identical;
the bullets are reviewed here — the Standards axis checked them against
`evidence/escalation-live-run.log` and found both factually accurate.

## Standards

**VERDICT: pass-with-findings** — zero documented-standard violations; six smell judgement
calls, none blocking.

(a) Documented-standard violations: **none found — verified, not assumed**:

- *Public seam, never source text* (`.claude/skills/tdd/SKILL.md`; CLAUDE.md lifecycle): the 22
  new tests drive only exported surfaces (`runQueue`, `runSingleIssue`, `runOverrideIssue`,
  `formatSummary`, `formatSingleIssueResult`) through the injected-dep seam. No source-text
  assertions.
- *Secrets seam* (`docs/agents/workflow.md` §Secrets; CLAUDE.md `assert-no-secrets` row): the
  comment body is guarded at `src/loop.ts:759` before the post, inside the same try — the
  existing revert-comment shape. Summary text is guarded at the CLI emission seam, the
  single-issue stderr per line, so the new FAILED suffix, `LABEL REMOVE FAILED` and
  `escalation comment failed` lines inherit the guard. The one new `console.log` is a static
  literal — correctly guard-free.
- *Recording never displaces the verdict* (WI-11 posture, CLAUDE.md row): the `escalation*`
  fields are spread **beside** `failure`/`failureKind`; `escalationLabelFailure` never enters
  `failed` and the success path keeps exit 0 (asserted by T3 (d)).
- *Module-table honesty* (CLAUDE.md "Keep this section honest… in the same PR"): the
  `src/loop.ts` row and the `docs/agents/workflow.md` command row are extended in this same
  delivery (FR-006). No command invented; **no lint step invented** (none exists).
- *Sandcastle boundary*: no new importer — the boundary test still passes.

(b) Smell judgement calls (all judgement, none blocking):

1. **Duplicated Code / tautological expectation — adjacent** — `expectedEscalationBody`
   (`src/loop.test.ts:3398`) restates production `buildEscalationComment` (`src/loop.ts:726`)
   line-for-line, so the expected value is recomputed the way the code computes it. A
   hand-written literal would be an independent source of truth, and would have caught a
   body-shape regression the current helper cannot.
2. **Duplicated predicate — adjacent** — the new gh-sourced guard is `input.issue.url ===
   undefined` (`src/loop.ts:752`) while the same file's close path uses `sourceType ===
   "github-issue"` (`src/loop.ts:1615`): two spellings of one concept. A shared
   `isGhSourced(issue)` would keep them from drifting apart.
3. **Primitive Obsession — adjacent (recorded as A11)** — one `escalationLabelFailure: string`
   serves both the add and the remove, disambiguated at render by branch (`:2485` vs `:2521`)
   and not by type. Correct today only because the add rides failure arms; a `{op, reason}`
   shape would say what it holds.
4. **Guard gap (weak) — adjacent** — `ensureHarnessFailedLabel` deliberately rethrows with gh
   `stderr` embedded in the message, and the top-level catch prints `error.stack` unguarded.
   This extends a pre-existing hole (`gh repo view` shared it) rather than opening a new one,
   and no secret value is known to reach it; noted, not blocking.
5. **Doc shape — minor** — the `docs/agents/workflow.md` command row has grown into a prose
   monolith carrying behaviour spec (the WI-13 and WI-14 surfaces both appended to it) rather
   than a list of commands. Cosmetic; the command list itself is accurate.
6. **`CLAUDE.md` Lessons rule — trivial** — the Self-learning rule says "add the lesson as a
   one-line rule"; the first new bullet runs to three lines. Content accurate, shape off-spec.

## Spec

**VERDICT: pass-with-findings** — FR-001..FR-006 faithfully implemented; no missing
requirement that blocks, three partial/scope notes and three records below.

Verified faithful, with the spec line each satisfies:

- **FR-001 surface parity** ("The trigger applies identically in the queue surface and the
  single-issue surface"): both entries share `runSingleIssueLane` — no forked trigger.
- **FR-001 PR-left exclusion** ("Outcomes that leave an open PR (review-uncertain,
  merge-failure posture, canary-red) never trigger the escalation"): escalation fires only at
  the `fail()` family (`:1006`) and the `preflight-failed` return (`:970`); review-skip, gate
  non-proceed, merge-throw, canary-red and uncanaried are all silent.
- **FR-002 absent-handle** ("the comment still posts with no `@` and the run summary states the
  handle is not configured"): no `@` line, comment still posts, both surfaces state the
  WI-11/12 literal `notify handle not configured`.
- **FR-003 / FR-004 / FR-005 "recorded as a summary line only"** ("A failed removal is recorded
  as a summary line only; the success verdict stands"): one try each, captured verbatim, never
  retried, pre-existing fields byte-identical, nothing extra posted.

(a) Missing or partial:

1. **FR-001 boundary vs two non-escalating outcomes — adjacent, defensible.**
   FR-001's Boundary reads "an issue failed by infrastructure (preflight/sandbox) escalates
   exactly like a fix failure", yet the attachment confidentiality-gate refusal (`:878`) and
   the `.loop-harness` nesting abort (`:895`) escalate nothing. FR-001's Behavior scopes the
   trigger to *outcomes* and the grilling D3 names only the `fail()` family, so this is the
   settled reading — recorded, not a gap.
2. **FR-001 — thrown sandbox errors produce no outcome at all — adjacent, follow-up.**
   `createFixSandbox` (`:929`) and `runFixRun` (`:987`) sit outside any try, so a throw rejects
   the lane: no outcome, no escalation, no label. FR-001 is framed as an outcome family, so
   this is defensible scope, but the spec's Boundary prose is broader than the implementation
   here and a future spec should either tighten the prose or cover the throw arm.
3. **FR-002 log pointer** ("a pointer to where the full log lives"): the pointer names the
   operator's console output, because no persisted log URL exists. Owner-visible via plan
   interpretation note 3 (no invented artifact) — literally weaker than the spec text.

(b) Not asked for (scope, all plan-authorized or disclosed):

1. `ensureHarnessFailedLabel` (`:2942`) writes to the target repo at run start — a
   `gh label create` even when zero issues run — and converts a create failure into a new
   pre-spend abort. FR-004 says only "adds a `harness-failed` label"; the create and the abort
   surface come from the plan, not the spec.
2. `escalation.outcomeClass` is carried on the outcome and read by no renderer — only
   `notifyHandle` is read (`:2172`, `:2530`). A test pins the record, so it is test-pinned
   state rather than dead code; still, nothing consumes it.
3. The two `CLAUDE.md` `## Lessons` lines post-date T4 (above) — outside FR-006's row, but
   authorized by CLAUDE.md's own Self-learning rule and disclosed in the notes.

(c) Implemented but questionable:

1. **The remove classifier is broader than FR-005's boundary — deferred, see classification.**
   `:2745` swallows any gh error matching `/not found|not present|does not exist|could not
   remove/i`, where FR-005's Boundary justifies only "a label removed by a human out-of-band is
   not an error (removal is idempotent — a missing label is success)". A genuine gh error
   matching those patterns is silently absorbed: stale label, no summary line.
2. **FR-005 amendment vs literal text — noted, accepted.** The widening fits FR-005's "fix
   verified and PR delivered": all four PR-left returns do leave a verified PR. Least
   comfortable is merger-gate non-proceed, where the thing that failed verification is the
   branch that would have merged; the cost is that the label no longer separates *delivered*
   from *landed*, so a human closing a review-skipped PR leaves an unfixed, unlabeled issue.
3. **FR-006 — `docs/agents/workflow.md` wording nit (recorded as A17).** "an inline
   `@<notifyHandle>` comment when a handle is configured plus a `harness-failed` label" parses
   as comment-only-with-handle, and so understates the absent-handle arm. The `CLAUDE.md` row
   is accurate.

## Controller verification

The controller re-checked the three claims that would have changed a verdict, rather than
accepting them:

- **"A FAILED line can say `notify handle not configured` for a comment that was never
  posted" — dismissed, not a defect.** `escalation.notifyHandle` is populated from
  `input.profile.notifyHandle` at `:775`, independently of whether the post threw. The clause
  at `:2530` therefore only fires when no handle genuinely is configured, and it states
  configuration, not post outcome. No false claim reaches the operator.
- **"A thrown `createFixSandbox`/`runFixRun` rejects the lane with no escalation" — confirmed
  as code behaviour, narrowed as a finding.** Verified at `:929`/`:987` (outside the try, and
  outside the `finally` that covers only `pre.exec`). It is pre-existing behaviour that this
  diff does not introduce or worsen, and FR-001 is framed as an outcome family — so it is
  recorded as a follow-up (Spec (a) 2), not as a WI-14 defect.
- **"`escalation.outcomeClass` is dead" — narrowed.** No renderer reads it, but
  `src/loop.test.ts:3478` asserts the record equals `{ outcomeClass: "fix-failed" }`, so the
  field is test-pinned; recorded as an observation, not as dead code.

## Classification

**Blocking findings: none.** No documented-standard violation and no unmet requirement was
found, so the branch is not sent back to stage 3.

Adjacent findings (recorded, not this delivery's scope): the tautological expected-body helper,
the two gh-sourced predicate spellings, the primitive-obsession label-failure field (A11), the
weak secrets-guard gap on rethrown subprocess text, the workflow.md doc shape (A17), and the
`CLAUDE.md` Lessons bullet shape.

**Re-raised deferral — the owner may override.** The Spec axis re-raised A9 (the over-broad
remove classifier). It stays **deferred, not blocking**: its effect is bounded and already
recorded in `verification.md` (a stale label with a silent summary line on an
already-verified, delivered success; no verdict is affected), and tightening a live classifier
unasked is the scope creep the spec's own FR-005 boundary guards against. It is named here
because it is the one finding with any reachable operator-visible consequence.

Missing evidence: none beyond the non-claims already stated in `verification.md` — the
`preflight-failed`, reverted, uncanaried and absent-handle arms were not produced live, and A9's
failure mode was not exercised.

## Summary

- **Standards:** 6 findings, 0 hard violations — worst in-axis: the tautological
  `expectedEscalationBody` helper (`src/loop.test.ts:3398`), a test that cannot fail on a body
  regression it exists to catch.
- **Spec:** 6 findings (3 partial/scope, 3 questionable), none blocking — worst in-axis: the
  over-broad remove classifier (`src/loop.ts:2745`, deferred as A9), the only finding with a
  reachable operator-visible consequence.

## Next step

Blocking findings: none. Proceed to `finishing-a-development-branch`, which requires explicit
authorization for each delivery action (delivery is a PR; this repository keeps human merge
under hard constraint 1).