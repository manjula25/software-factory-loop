# WI-11 — Implementation notes

## Controller setup (2026-09-19)

- Worktree `.claude/worktrees/wi-11`, branch `worktree-wi-11`, from local
  main `cddaf49` (post-ponytail plan). Plan: `docs/work/WI-11/implementation-plan.md`.
- Baseline (fresh, in worktree): `npm run typecheck` → exit 0;
  `npm test` → 10 files / 216 tests passed. GREEN baseline confirmed.
- Task classification: T1 small/low-risk (record-shape + rendering,
  no decision logic); T2 small/low-risk (attachment restructure on
  fail()-returns); T3 small/low-risk (one conditional arm + pin updates);
  T4/T5 docs-only, controller-executed. Time budget: half-day equivalent;
  tool budget: one leaf implementer per task, two reviewers per task.
  Evidence boundary: harness-source surface only (`src/loop.ts` +
  `src/loop.test.ts`, vitest); no pipeline/Docker claims (spec non-claims).

## T1 — FR-001 both teardown origins (slice 1)

- Dispatched leaf implementer with task brief for plan Task 1 (design
  pinned by decision d1; ponytail amendment: pre-composed MERGED teardown
  suffix, no tuple growth). Fixed point `cddaf49`; intended candidate:
  one commit on `worktree-wi-11`.
- Results: appended below on acceptance.

### T1 accepted (candidate `bbd3d1c`, 2026-09-19)

- RED observed for the designed reason (canary message overwrote the early
  reason; no `canaryTeardownFailure` field). Focused: 109/109. Gates
  (controller-rerun, fresh): typecheck exit 0; `npm test` 10 files /
  217 passed (baseline 216 + test (p)).
- Specification review: PASS, no blocking findings. Ruled the two test-(l)
  pin updates within the spec's sanction (precedence pin + ponytail-mandated
  tuple-suffix pin; the user-visible MERGED-line guard byte-identical);
  ruled the `sandboxCloseThrowsFor` queue knob justified test infrastructure.
  Advisory (non-blocking): reverted path now also renders the early reason
  as a FAILED suffix — designed by plan step 3, d1 posture.
- Code-quality review: PASS, no blocking findings; idiom consistency good.
  ADJACENT follow-up recorded: the reverted-path early-teardown lift
  (`src/loop.ts:1084`) has no dedicated test (test (p) covers merged only).
  TASTE (no action): nested-ternary suffix composition; origin-labeling
  asymmetry in single-origin rendering (deliberate byte-identity).
- Deviations: none from the pinned design. The plan's "no existing pin
  should change" line was over-strict vs the spec's sanction — spec wins;
  recorded here rather than silently amending the plan.

## T2 — FR-002 fail()-path teardown recorded (slice 2)

- Dispatched leaf implementer from `bbd3d1c`; candidate `cfc7d3f`.
- RED observed for the designed reason (`outcome.teardownFailure` undefined
  on the fail path). Focused: 110/110. Gates (controller-rerun, fresh):
  typecheck exit 0; `npm test` 10 files / 218 passed. Zero existing tests
  modified.
- **Sanctioned deviation (controller-verified before commit):** the plan's
  literal `sandboxTeardown` spread would overwrite the preflight teardown
  failure `fail()` already attaches when both early teardowns fail —
  regressing WI-8's "preflight wins" precedence. Implemented
  `earlyTeardown` (`preflightTeardown ?? sandboxTeardown`) instead;
  controller checked all four cases (preflight-only, verification-only,
  both, neither) — idempotent or correct in each. Spec review accepted it:
  FR-002 nowhere sanctions displacing an already-recorded origin, and
  FR-001/d1 establishes the no-displacement posture.

### T2 accepted (candidate `cfc7d3f`, 2026-09-19)

- Specification review: PASS, no blocking findings — all three failure
  sites covered, zero rendering changes, reason/kind/exit codes verbatim,
  else-chain verified semantically identical to the old early-returns.
- Code-quality review: PASS, no blocking findings — the else-chain mirrors
  the WI-8 preflight idiom in the same function (same reason it exists:
  early returns bypass teardown capture); comments accurate; `failOutcome`
  and `prUrl` structurally mutually exclusive. TASTE (no action): "(e2)"
  label; assignment-of-await phrasing.
- ADJACENT follow-up recorded: no test covers fail()-path with BOTH early
  teardowns failing (precedence-preserving spread correct by construction,
  unobserved at the seam).

## T3 — FR-003 unified notify vocabulary (slice 3)

- Dispatched leaf implementer from `cfc7d3f`; candidate `30d59b6`.
- RED observed for the designed reason (received string showed
  `notify: not configured`). Focused: 111/111. Gates (controller-rerun,
  fresh): typecheck exit 0; `npm test` 10 files / 219 passed. Zero
  existing tests modified (grep: none ever pinned the old string).

### T3 accepted (candidate `30d59b6`, 2026-09-19)

- **Controller error caught by the process:** the task brief's literal
  expression kept the colon (`notify: handle not configured`), contradicting
  the brief's own mandated assertion, the plan's "(no colon)" note, and
  FR-003. The implementer applied the literal form, observed it fail, and
  implemented the colon-free form. Spec review: "the plan text was the
  error." The implemented form is spec-correct.
- Specification review: PASS, no blocking findings — all three absent-handle
  surfaces now identical (`src/loop.ts:311/:1097/:1415`); present-handle
  rendering byte-identical and newly pinned at the single-issue seam.
- Code-quality review: PASS, no blocking findings — ternary matches the two
  sibling surfaces' exact shape (and fixes a latent empty-string-handle
  mis-render the `??` form had); comment in style; test (f2) mirrors
  sibling conventions. TASTE: none actionable. ADJACENT recorded: the
  canary line's present-handle arm renders bare (`notify: manjula25`) vs
  siblings' `notify: @manjula25` — intentional (WI-10 live observation,
  FR-003-pinned); future vocabulary pass if @-rendering ever unifies.
