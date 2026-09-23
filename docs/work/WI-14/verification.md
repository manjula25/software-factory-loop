# WI-14 — Verification Record

Per-checkpoint and completion evidence for the `implement` loop on
`worktree-wi-14`. Claims below state only what fresh runs proved, for the exact
candidates named. Non-claims are explicit and are not passes.

## Candidate identity

| Field | Value |
|---|---|
| Candidate | `785a026` (HEAD of `worktree-wi-14`) |
| Base | `ef8d52e` (`main`) |
| Ancestry | valid — `git merge-base --is-ancestor ef8d52e HEAD` succeeded |
| Range | non-empty — 13 commits |
| Working tree | clean (`git status --short` empty) |
| Changed paths | 8 — `src/loop.ts`, `src/loop.test.ts`, `CLAUDE.md`, `docs/agents/workflow.md`, `docs/work/WI-14/{verification,implementation-notes,implementation-plan}.md`, `docs/work/WI-14/evidence/escalation-live-run.log` |
| Source deltas | `src/loop.ts` +334/−7, `src/loop.test.ts` +547 |

## Claim

WI-14's escalation surface is implemented as specified (FR-001..FR-006) in
`src/loop.ts`, proven behaviorally at the public seam by 22 new vitest tests,
witnessed live against a real GitHub issue and a real Docker sandbox, and
documented in the same delivery. It changes no existing verdict field.

## Completion gates — run fresh at `785a026`

Run from the worktree root (`docs/agents/workflow.md` is the authoritative
command list; both surfaces are scaffolded and there is **no lint surface**, so
none was invented or run).

| # | Claim | Proving command | Result |
|---|---|---|---|
| 1 | Harness source is type-clean | `npm run typecheck` | **exit 0** |
| 2 | WI-14 behavior at the public seam | `npx vitest run src/loop.test.ts` | **exit 0** — 162/162 passed (1 file) |
| 3 | No regression on any surface | `npm test` | **exit 0** — 283/283 passed, 10 files |
| 4 | Sandbox image builds | `npm run build:image` | **exit 0** — `Build complete!` |
| 5 | Image carries the 9 required tools | `npm run smoke:image` | **exit 0** — 9/9 `ok:` (python, pytest, node, git, gh, claude, codex, opencode, non-root agent user) |

`162 − 140 = 22` new tests are WI-14's; the pre-WI-14 focused count was 140, and
the full-suite count rose 261 → 283 across the branch's history (per-checkpoint
counts in `implementation-notes.md`). Files in the suite: `assert-no-secrets`,
`attachments`, `env`, `issues`, `loop`, `onboard-profile`, `providers`, `queue`,
`sandcastle-adapter.boundary`, `verify`.

Gates 4–5 are **candidate-independent**: `git diff --stat ef8d52e..HEAD --
Dockerfile* scripts/` is empty, so the image surface is identical to base. Gate
5 is therefore a statement about the image, not about this candidate.

## FR → evidence map

Every FR traces to named tests in `src/loop.test.ts` (the public seam).

| FR | Requirement | Proving evidence |
|---|---|---|
| FR-001 | Trigger = the no-visible-artifact family; PR-left never triggers; surface parity | T1 (a) verification-red fires; (c) preflight fires; (f) review-uncertain + merge-failure never fire; (g) single-issue entry produces the same body as the queue surface. T2 (a) + (a-preflight) the label rides the same trigger; (d) never `add` on PR-left |
| FR-002 | Comment content, handle arm, verbatim reason, log pointer, no excerpts | T1 (a) body carries `@manjula25` + `Outcome: fix-failed` + the verbatim FAILED-line reason; (b) handle absent → body has **no** `@` and both surfaces state `notify handle not configured` (D6); (c) `Outcome: preflight-failed`; (g) same body from the single-issue entry. Live-confirmed in T5 (run 2/3) |
| FR-003 | Inline timing, posting-failure recording, no retry | T1 (d) `commentOnIssueThrows` → outcome unchanged, throw recorded verbatim, `exactly one call` (no retry), summary carries the line; (e) non-gh source → never called and the FAILED line keeps its byte-identical shape |
| FR-004 | Label add on the same trigger; failure = summary line only | T2 (a) one `add` beside the comment; (a-preflight) the preflight arm too; (b) `setLabelThrows` → recorded verbatim, outcome and comment call otherwise unchanged, both surfaces carry the line; (c) non-gh → never called |
| FR-005 | Label remove on later success; idempotent; failure = summary line only | T3 (a) green PR-opened return removes once; (b) merged + canary-green chain; (c) reverted/uncanaried never remove; (d) a throwing remove recorded verbatim, never retried, merged outcome unchanged, run stays green; (e) non-gh → never called. T3b (a) merger-gate non-proceed; (b) review-skip; (c) `mergePr` throws; (d) halted sibling; (e) a failed remove on a PR-left return recorded and the PR'd outcome stands |
| FR-006 | Docs honest in the same delivery | T4 docs-accuracy diff review of `e07584e` — PASS (claim-by-claim against `src/loop.ts`) |

## Live evidence (T5) — external, and bound to this candidate

Durable record: `docs/work/WI-14/evidence/escalation-live-run.log` (verbatim
console logs, verbatim GitHub artifacts, and the agent's own reasoning log).
Target `manjula25/loop-fixtures-py` — a **public synthetic fixture repo**, so
hard constraint 3 is not engaged. Provider `claude-via-proxy`.

| Plan step | Result |
|---|---|
| 1. Seed an unfixable issue | Done — #52 (invalid seed, see below) then #54 (valid) |
| 2. `build:image` + `smoke:image` | 9/9 ok |
| 3. Run → FAILED, no PR, one comment (`@`), label added, reason verbatim | **Confirmed** |
| 4. Make fixable, re-run → success, label gone | **Confirmed** |

Proven live: the lane FAILED with exit 1, **no PR** and no leftover `fix/*`
branch; **exactly one** escalation comment carrying `@manjula25`,
`Outcome: fix-failed`, and a `Reason:` **byte-identical** to the console summary
line; the `harness-failed` label added and the issue left OPEN; and, on the
amended re-run, the full success path (PR #55, squash-merge `f22c294`, canary
green on main, issue closed, exit 0) with the label going
`["harness-failed"]` → `[]`. A negative check too: the success path posted
**only** the close comment, so no escalation rode a run that did not fail.

Two unplanned results, both real:
- `ensureHarnessFailedLabel`'s **already-exists classifier fired live** (three
  runs) — the arm whose dead-code regex was T2's blocking defect (`69fddac` →
  `5470a97`). Before that fix these runs would have **aborted pre-spend**. The
  fix is now proven against real `gh`, not just a stub.
- The idempotent **already-absent removal** was exercised live when a success
  path ran on an issue with no label (run 1), which completed normally — so it
  cannot have been an error.

**Why this live evidence binds to `785a026`:** the runs executed with `src/` at
`e07584e`, and the source is byte-identical across that point and the candidate —
`git diff --stat e07584e..785a026 -- src/` is empty, and the blob SHAs match
(`src/loop.ts` = `e51d2f82…`, `src/loop.test.ts` = `3a890e34…` at both). The live
runs therefore exercised exactly the source being verified.

**Run 1 was a controller error, recorded rather than hidden.** My first "unfixable"
seed put the contradiction *between two call sites*, which the agent resolved
honestly by adding a `split_hyphens` parameter — so that run succeeded and proved
nothing about escalation. The re-seed moved the contradiction onto the **same
no-argument call**, both sides pinned; the agent then refused to commit, and
explicitly rejected reusing its own earlier parameter escape.

## Unknowns — reconciled

**Closed:**

| Unknown | Closed by |
|---|---|
| A6 — do the confidentiality-gate and nesting-guard arms escalate? | Settled by the plan/grilling D3 family (repro, verification, preflight/sandbox only). Recorded as the settled reading, not a gap |
| T2 blocking defect — is the already-exists classifier reachable? | **Closed live** in T5 (fired three times against real `gh`) and by the reviewer's stubs at `5470a97` |
| `gh issue comment` / `gh issue edit` wiring is untested by vitest | Closed by T5: the real wiring ran against real `gh`, and the artifacts were read back from GitHub |
| FR-005 removal is only vitest-proven | Closed by T5 run 3 (present-label removal, read back from GitHub) |
| T5 step 4 was unrun | Closed by T5 run 3 (separately authorized) |

**Deferred, with effect and owner:**

| Unknown | Effect if it bites | Owner |
|---|---|---|
| A9 — the label-remove classifier matches `not found` broadly, so a *genuine* gh error during a remove is swallowed as success. Deferred by controller instruction (T2 ledger promised it to T3; T3/T5 did not do it — the regex is live surface and tightening it unasked is scope creep) | A stale label with a silent summary on an already-verified, delivered success. No verdict is affected | WI-14 follow-up |
| A5 — the *comment* side's reverted/uncanaried non-triggering is pinned by code reading, not a test (the *label* side **is** pinned, T3 (c)) | A future regression making those arms escalate would not be caught by the suite | WI-14 follow-up |
| A11 — add-failures and remove-failures share the one `escalationLabelFailure` field, disambiguated by branch not by type (verified disjoint today) | A future post-PR escalation would silently mislabel as a removal | WI-14 follow-up |
| A12 — no test pins the close→remove ordering, nor a close-failure × remove-failure combination | Coverage gap only; no behavior is unpinned | WI-14 follow-up |
| A1–A4, A7, A8, A10, A13–A17 — adjacent findings, individually recorded in `implementation-notes.md` | Cosmetic / test-hygiene; none changes WI-14 behavior | WI-14 follow-up |
| O1–O3 — console-wording, leftover-worktree, and iteration-budget observations from the live runs | Outside WI-14's surface; none caused the failure | Not WI-14's |

## Remaining risks

- **The label is the harness's only cross-run state** (FR-005 non-claim). If a
  removal is swallowed (A9), the issue wears `harness-failed` while no longer
  failing. Bounded and recorded, not silent.
- **Stale-baseline spam** (plan interpretation note 2): a stale profile fails
  every lane that reaches preflight, and each one escalates. Bounded by wave
  size, accepted deliberately rather than special-cased.
- **CLAUDE.md was edited after T4** — two `## Lessons` lines added under its own
  Self-learning rule. Disclosed in `implementation-notes.md`; the row T4 was
  reviewed for is byte-identical, but the new lines have not themselves been
  independently reviewed, and the branch-level `code-review` must cover them.

## Explicit non-claims

- **Not** produced live: the `preflight-failed` arm, the reverted/uncanaried
  outcome arms, and the **absent-handle** (`notify handle not configured`) arm.
  The fixtures profile sets a handle, so only the present arm was witnessed;
  those arms rest on vitest alone.
- **A9's failure mode is unproven** — no run produced a genuine gh error during a
  label remove. Only the intended idempotent-absent branch was exercised, so the
  classifier's behavior on a real error is a stated gap.
- The live evidence covers **only** `manjula25/loop-fixtures-py` (a synthetic
  public fixture). No claim is made about any other repo, and none about a client
  repo.
- The image/smoke result is **candidate-independent** — the Dockerfile and
  `scripts/` are unchanged from base.
- Vitest proves **behavior through the injected `LoopDeps` seam**, not the wiring
  inside `main()`; for this work item the wiring is covered by T5's live runs
  instead, which is stronger than a unit test would have been but is not
  repeatable in CI.
- No lint claim exists — there is no lint step in this repo and none was added.
- WI-14 changes **no merge policy**: this repository still keeps human merge
  (hard constraint 1).

## Approval to proceed

Every completion claim above maps to fresh successful evidence for `785a026`
(gates 1–5 re-run at this exact commit, exit codes recorded) or to external
evidence bound to it by matching source blob SHAs. Unknowns are closed or
deferred with owners and effects. The record is fresh and complete.