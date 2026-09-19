# WI-8 Code Review — failure-surface parity batch

Fixed point: `3c3f214` (main). Candidate: `6a2047f` (branch `worktree-wi-8`,
HEAD, clean tree). Ancestry verified; range non-empty (14 commits).

Changed paths (8, all accounted):
`src/loop.ts`, `src/loop.test.ts` (code); `docs/work/WI-8/{prd.md,
slices.md, specification.md, implementation-plan.md, implementation-notes.md,
verification.md}` (planning chain + evidence, no code).

Reviewed per the four-axis process with parallel read-only axis reviewers;
each verdict is separate and evidence-backed.

## Axis 1 — repository standards: FAIL

**Blocking finding (B1):** CLAUDE.md's "What is built so far" rule — "if you
add a surface, say so here in the same PR that adds it" — was not honored.
The diff adds a new exported surface (`formatSingleIssueResult`), extends
teardown-failure recording from the canary to the preflight and verification
sandboxes (queue FAILED-line suffix + single-issue stderr line), and adds the
uncanaried notify ping — none reflected in the `src/loop.ts` module-table row,
which still credits teardown recording to the canary only. Fix: one-row
CLAUDE.md amendment on this branch.

Passes: workflow.md command surface respected (no lint invented); commit
messages all reference WI-8; docs follow `docs/work/{WORK_ITEM}/` with the
sanctioned planning artifacts; house idioms matched (colocated public-seam
vitest, conditional field spreads, `assertNoSecrets` at the emission seam, no
env echoes). Judgment calls (non-blocking): unconditional
`notify handle not configured` adds summary noise on every uncanaried event
(defensible); test (o)'s `not.toContain("@")` breadth (acceptable).

## Axis 2 — specification fidelity: PASS

Missing/partial: one documented boundary — on `fail()`-returned paths inside
the verification try, a `close()` throw is caught (outcome preserved) but
`sandboxTeardown` is discarded. Partial against FR-001's broad behavior
sentence, sanctioned against its success criteria (which name only the two
RED modes + the green-baseline-proceeds case, all implemented and tested) and
declared in the plan and verification records. Scope creep: none material —
the builder extraction is verbatim and byte-stable (test ii pins it), the
FAILED-line suffix is FR-001's "existing surfaces," `notifyHandle` is the
data the posture needs. Wrong implementations: none; the FR-003 no-handle
reading (comment mention-free, posture in the detail) matches the reverted
path's existing behavior, the spec's named anchor. Both approved design
decisions implemented as decided and tested.

## Axis 3 — evidence and risk integrity: PASS

Checkpoint arithmetic chains exactly (207/99 → 211/103 → 214/106 → 216/108;
4+3+2 new tests in the diff); RED is behavioral at every checkpoint (raw
throws, missing-line and missing-content assertion failures; T2's
scaffold-first stub check honestly recorded; test (ii) honestly labeled a
no-change regression pin); both T3 pin-update batches *strengthen* assertions
(required field added to an exact-record toEqual; longer exact strings) — no
weakened matchers; non-claims and boundaries stated at every checkpoint and
at completion; per-checkpoint reviews recorded against fixed pinned packages;
hard constraints 1/2 untouched (the cc rides the existing best-effort comment
on the already-halting path — a compensating control, not a new merge path).
Reviewer independently re-ran at `6a2047f`: typecheck 0, full 10/216, focused
108 — matching the completion record.

## Axis 4 — unnecessary complexity: PASS

No speculative generality (every knob/field/export has a test consumer);
`formatSingleIssueResult` earns its keep (minimum shape that decouples the
guard from the console); `earlyTeardown` binding is the reduction direction.
Taste-level (non-blocking, recorded to the backlog): three teardown try/catch
shapes (a shared helper would blur per-site ordering semantics; the truly
duplicated error-extraction idiom is pre-existing file-wide); the
`sandbox teardown failed:` template at n=2 stays below the repo threshold;
three `teardownFailure` attachment sites are the next place duplication bites
if a fourth outcome grows the field.

## Verdict summary and blocking-finding resolution

| Axis | Verdict |
|---|---|
| Repository standards | FAIL → fixed (B1) |
| Specification fidelity | PASS |
| Evidence and risk integrity | PASS |
| Unnecessary complexity | PASS |

**B1 resolution:** CLAUDE.md `src/loop.ts` module-table row amended on this
branch to name the WI-8 surfaces (teardown parity across all three sandboxes,
`formatSingleIssueResult`, the uncanaried notify ping), restoring the
same-PR honesty rule. Docs-only change; the code candidate `112800e` (gates
pinned in verification.md) is untouched, and the gates were re-run green at
the fix commit for the record.

**Unverified / out of evidence boundary:** no pipeline-integration
(Docker/gh) execution of any WI-8 behavior is claimed anywhere; teardown
failures were exercised via throwing-dep knobs only; `main()`'s emit loop is
typechecked + seam-verified, not CLI-executed.

**Adjacent observations carried to the follow-up backlog:** canary-wins
teardown precedence (single-field structure, pre-existing);
fail()-path `sandboxTeardown` drop (brief-sanctioned boundary);
cross-stream emit ordering; stale WI-6 comment wording; reverted-surface
`notify: not configured` vs `notify handle not configured` vocabulary
mismatch (pre-existing, T3 quality review); teardown try/catch shape /
template duplication (taste, revisit at n=3); (j)-pin inline comments (taste).
