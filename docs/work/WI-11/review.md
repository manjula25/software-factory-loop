# WI-11 — Code review (four axes)

## Identities

- Fixed point: `cddaf49` (local main)
- Candidate: `ee0a36d` (branch `worktree-wi-11`, HEAD at review time)
- Range: `cddaf49..ee0a36d` — 7 commits, 6 files (`src/loop.ts`,
  `src/loop.test.ts`, `CLAUDE.md`, `docs/work/WI-9/verification.md`,
  `docs/work/WI-10/evidence/run-endstates.md`,
  `docs/work/WI-11/{implementation-notes,verification}.md`)
- Both reviewers re-ran gates fresh independently: typecheck exit 0;
  `npm test` 10 files / 219 passed.

## Axis verdicts

| Axis | Verdict |
|---|---|
| 1 — Repository standards | PASS |
| 2 — Specification fidelity | PASS |
| 3 — Evidence & risk integrity | PASS (conditional record fix applied, see below) |
| 4 — Unnecessary complexity | PASS |

## Findings (no blocking findings)

**A1 (ADJACENT, axis 2) — canary-only report-line rendering changed.**
FR-001's letter says "when only one origin failed, output is unchanged."
The single-issue report line for a CANARY-only teardown on a merged run
changed from `sandbox teardown failed: <r>` to `canary teardown failed:
<r>` — origin-labeling, d1-consistent, and no test ever pinned the old
line (the MERGED-line and all early-origin renderings are byte-identical,
pinned). Accepted as d1-consistent; if the owner wants strict letter
conformity, a follow-up could relabel or pin that surface.

**A2 (ADJACENT, axes 2) — reverted-path early-teardown lift beyond the
enumerated merged surfaces.** `src/loop.ts:1104` spreads
`prOutcome.teardownFailure` onto the reverted outcome — beyond FR-001's
named surfaces, untested at the seam, honestly recorded in the
implementation notes. Accepted as documented (d1's no-displacement
posture).

**A3 (ADJACENT, axes 1) — same seam-coverage gap as the checkpoint
reviews:** the reverted-path lift (A2) and the fail()-path
both-early-teardowns case have no dedicated tests. Correct by
construction; follow-up work if wanted.

**Record fix (axis 3, applied):** verification.md claim 1 originally said
"single-failure rendering is byte-identical" unscoped — exceeding what
the tests prove, per finding A1. The claim is now scoped to the MERGED
line and early-origin surfaces, with A1's surface named. Record-only
commit; no behavior change; the reviewed code range is untouched.

**TASTE (axis 1/4, no action):** assignment-of-await phrasing
(`failOutcome = await fail(...)`); nesting depth added by the else-chain
(mirrors the WI-8 preflight idiom); dense ternary composing the teardown
suffix (documented, byte-identity guarantee).

## Pin-update audit (axis 2, complete enumeration)

1. Test (l) `outcome.teardownFailure` → `toBeUndefined()` + canary-field
   assertion — sanctioned (old single-field precedence).
2. Test (l) mergedPrs 4th element raw reason → `teardown: <reason>` —
   sanctioned (consequence of the precedence redesign; rendered
   MERGED-line pin unchanged and byte-identical).
3. `makeQueueDeps` helper addition — infrastructure, not an assertion.
4. FR-003 modified zero existing pins (grep-confirmed).

## Specification-fidelity summary (axis 2)

FR-001 per d1 (field pair, no displacement, 4-slot tuple, pre-composed
suffix); FR-002 all three fail sites with reason/kind verbatim and
stale-abort paths untouched; FR-003 string-level only, 3-site unification
grep-confirmed; FR-004 append-only addenda (deletion grep: zero content
deletions) + corrected comment; FR-005 module row accurate, same-PR.
FR-006 correctly NOT executed.

## Evidence-integrity summary (axis 3)

Records honest; non-claims explicit (no pipeline, FR-006 pending,
uncanaried early-teardown drop confirmed in code); T2/T3 recorded
deviations verified accurate against the diff; PR #13/#27 body citations
presented as citations, not local observations; hard constraints 1–6
untouched. The one record-only correction is applied above.

## Complexity summary (axis 4)

Ponytail ladder applied to the four named points — second teardown field
(d1-mandated minimal shape), pre-composed suffix (no tuple growth),
else-chain (minimal-diff, in-idiom), fixture knob (mirrors siblings) —
all kept as minimal conforming shapes; nothing speculative added.
