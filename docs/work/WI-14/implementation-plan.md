# WI-14 — Implementation Plan

Approved scope: `docs/work/WI-14/specification.md` (FR-001..FR-006, approved
2026-09-20), carved from grilling record `docs/work/WI-14/prd.md` (D1–D8) via
`docs/work/WI-14/slices.md`. Five tasks: three behavior (T1–T3), docs (T4),
live validation (T5). All behavior lands in `src/loop.ts` with tests in
`src/loop.test.ts`, at the public seam per repo convention. No lint step
exists; none is added.

## Repository facts this plan builds on (verified 2026-09-20)

- The per-issue loop (`runSingleIssue` in `src/loop.ts`) is shared by the queue
  lanes and the single-issue entry — one implementation gives FR-001's surface
  parity; tests pin both entries.
- The `fail()` choke point (`src/loop.ts:853`) covers "no commits" and
  verification-red (which itself covers RED-truthfulness) — two of the three
  trigger arms. The third arm, the stale-baseline preflight return
  (`src/loop.ts:827`, `failureKind: "harness"`), returns directly and bypasses
  `fail()`; it gets its own hook.
- The notify vocabulary exists: `input.profile.notifyHandle`
  (`src/loop.ts:94`), absent-vs-@-rendered arms (WI-11/12), D6 absent shape
  (WI-6). `NormalizedIssue.url` is present only for gh-sourced issues
  (`src/issues.ts:18`) — the escalation's gh-only guard.
- Real wiring lives in `main()` (`src/loop.ts:2443` region): `commentOnPr` →
  `gh pr comment`, `closeIssue` → `gh issue close <n> --comment`. WI-14 adds
  the issue-comment and label sisters beside them.
- Comment-on-failure posture precedent: canary-red's `commentOnPr` call sites
  catch, record, and never let the throw past the outcome.
- Commands (authoritative: `docs/agents/workflow.md`): harness source —
  `npm run typecheck`, `npm test`; pipeline — `npm run build:image`,
  `npm run smoke:image`, `npm run loop -- …`.

## Interpretation notes (bounded, traced to spec)

1. **Uncanaried merge does not remove the label.** FR-005 names "fix verified
   and PR delivered, or the issue closed as fixed"; an uncanaried merge is
   delivered-but-unverified, and the revert re-queue guard may re-run the issue.
   Removal rides exactly two outcomes: the green-verified PR-opened return, and
   the merged + canary-green + issue-closed chain. (FR-005 boundary.)
2. **Stale-baseline spam is accepted.** A stale profile fails every lane that
   reached preflight; each failed lane escalates per FR-001 ("preflight/sandbox
   failure escalates exactly like a fix failure"). Bounded by wave size;
   honest; recorded here rather than silently special-cased.
3. **Log pointer.** No persisted log URL exists, so the comment's evidence
   pointer names the operator's console output and notes the run summary
   repeats the reason verbatim — no invented artifact (FR-002 honesty).

## T1 — Escalation comment on the failure arms (FR-001 trigger, FR-002, FR-003)

**Files:** `src/loop.ts`, `src/loop.test.ts`.

**Behavior.** New `LoopDeps` member:

```ts
/** WI-14 (FR-002): post an escalation comment on a gh-sourced issue
 *  (`gh issue comment <n> --body <body>`). Best-effort at the call site:
 *  a throw is recorded, never propagated past the outcome. */
commentOnIssue(repoDir: string, issue: NormalizedIssue, body: string): Promise<void>;
```

Module-private `buildEscalationComment(input: { outcomeClass: string; reason: string; handle?: string }): string`:
`@<handle>` line when the handle is present (absent → no `@` line, per D6),
then `Automated fix attempt failed.`, `Outcome: <outcomeClass>`, `Reason: <reason>`
(byte-identical to the summary reason), and the console-output pointer
(interpretation note 3). The body passes `assertNoSecrets` before emission.

Hook, inline at both failure arms (D5), gh-sourced only (`issue.url` present —
FR-002 boundary): (a) inside `fail()` before its return, outcomeClass
`fix-failed`; (b) at the stale-baseline preflight return, outcomeClass
`preflight-failed`. Each call is wrapped: a throw is captured verbatim into a
new optional `LoopOutcome` field `escalationCommentFailure?: string`; the
returned outcome is otherwise byte-identical to today's.

Surface the recording: `escalationCommentFailure` renders in
`formatSingleIssueResult` (a `escalation comment failed: <reason>` line) and as
a suffix on the queue's FAILED line — same pattern as the teardown-failure
suffix (WI-8).

**RED (write first, expect failure):** in `src/loop.test.ts` —
(a) verification-red run, gh-sourced issue, handle present → `commentOnIssue`
called once with a body containing `@manjula25`, `Outcome: fix-failed`, and the
verbatim reason; (b) same with handle absent → body has no `@`, summary states
the handle is not configured; (c) stale-baseline harness failure →
`commentOnIssue` called with `Outcome: preflight-failed`; (d) knob
`commentOnIssueThrows` → outcome unchanged, `escalationCommentFailure` set,
`commentOnIssue` called exactly once (no retry), summary carries the line;
(e) non-gh issue (no `url`) → `commentOnIssue` never called, outcome unchanged;
(f) PR-left outcomes (review-uncertain, merge-failure) → never called;
(g) single-issue entry → same body as (a).

**GREEN:** implement as above; `npm run typecheck` exit 0; `npm test` green
(focused file first: `npx vitest run src/loop.test.ts`, then the full suite).

**Commit:** `feat(WI-14): escalation comment on failed fix attempts (FR-001..FR-003)`

## T2 — `harness-failed` label add (FR-004)

**Files:** `src/loop.ts`, `src/loop.test.ts`.

**Behavior.** New `LoopDeps` member:

```ts
/** WI-14 (FR-004/FR-005): add/remove the `harness-failed` label on a
 *  gh-sourced issue (`gh issue edit <n> --add-label|--remove-label`).
 *  Removal is idempotent by contract: an issue not wearing the label
 *  resolves successfully. Best-effort at the call site: a throw is recorded
 *  as a summary line only. */
setIssueLabel(repoDir: string, issue: NormalizedIssue, op: "add" | "remove"): Promise<void>;
```

Hooked immediately beside the T1 comment call at both failure arms (same
trigger, D6): `op: "add"`. A throw captures into
`escalationLabelFailure?: string` (same recording shape as T1); the outcome is
untouched. Real wiring in `main()`:

- `setIssueLabel` → `gh issue edit <n> --add-label harness-failed` /
  `--remove-label harness-failed`; for `remove`, an exit indicating the label
  is absent resolves successfully (contract above).
- `ensureHarnessFailedLabel(dir)` helper (wiring-only, called once at run start
  for gh-sourced runs): `gh label create harness-failed --color B60205
  --description "automated fix attempt failed"`; a "already exists" failure is
  caught and logged to console, never fatal.

**RED:** (a) each failure arm → label `add` called once, comment still called;
(b) knob `setLabelThrows` → `escalationLabelFailure` set, outcome and comment
call unchanged, summary line present; (c) non-gh → never called;
(d) PR-left outcomes → never called.

**GREEN:** implement; typecheck + full suite green.

**Commit:** `feat(WI-14): harness-failed label added on failed attempts (FR-004)`

## T3 — Label removal on verified success (FR-005)

**Files:** `src/loop.ts`, `src/loop.test.ts`.

**Behavior.** `setIssueLabel(…, "remove")` rides exactly the two
verified-delivered outcomes (interpretation note 1): (a) the green-verified
PR-opened return (both surfaces share it); (b) the merged + canary-green +
issue-closed chain, beside the existing `closeIssue` call. Reverted and
uncanaried outcomes never remove. Same recording: a throw →
`escalationLabelFailure` on the (successful) outcome; verdict untouched.
Wiring idempotency from T2 covers the human-removed-label case.

**RED:** (a) green PR-opened run on a labeled issue → `remove` called once;
(b) merged + canary-green → `remove` called (beside `closeIssue`); (c)
reverted and uncanaried outcomes → `remove` never called; (d) knob → failure
recorded, merged/PR outcome unchanged.

**GREEN:** implement; typecheck + full suite green.

**Commit:** `feat(WI-14): harness-failed label removed on verified success (FR-005)`

## T4 — Docs honesty (FR-006)

**Files:** `CLAUDE.md`, `docs/agents/workflow.md`.

**Behavior.** Same PR as the code: CLAUDE.md `src/loop.ts` row gains the
escalation surface (comment + `harness-failed` label on failed attempts,
removal on verified success, recording posture); `docs/agents/workflow.md`
Repository-commands `npm run loop` row gains one clause naming the escalation.
No other rows touched.

**Verification:** diff review — both docs name the surface, nothing else
drifts.

**Commit:** `docs(WI-14): CLAUDE.md + workflow.md rows for the escalation surface (FR-006)`

## T5 — Live validation (slice 3)

**Files:** none in `src/` — evidence to `docs/work/WI-14/evidence/`.

**Steps.** Against the fixtures repo (`manjula25/loop-fixtures-py`, profile
`autoMerge: true`):

1. Seed one deliberately unfixable issue (a described behavior no code change
   can satisfy — e.g. "function `initials` must also work when passed `None`"),
   via `gh issue create`.
2. `npm run build:image && npm run smoke:image` (expect 9 checks).
3. Run the loop (`npm run loop -- --repo <fixtures-dir> --provider <name>
   --issue <n>`). **Expected:** the issue ends FAILED with no PR; the GitHub
   issue carries exactly one escalation comment (with `@` if the fixtures
   profile sets a handle) and the `harness-failed` label; the console summary
   repeats the verbatim reason.
4. Fix the seed honestly (push a real fix to fixtures main, or amend the issue
   to something fixable), re-run. **Expected:** success path, and the
   `harness-failed` label is gone from the issue.
5. Record verbatim log + observations in
   `docs/work/WI-14/evidence/escalation-live-run.log`.

**Commit:** `docs(WI-14): live-run evidence — escalation comment + label lifecycle (T5)`

## Sequencing and rollback

T1 → T2 → T3 → T4 → T5; T2 rides T1's hook points, T3 rides T2's dep, T5
validates all. Each task is one coherent commit on the worktree branch
(`worktree-wi-14` per workflow policy); any task can revert independently —
the escalation is additive to the outcome objects and never alters an existing
verdict field, so a partial revert leaves pre-WI-14 behavior byte-identical.

## Traceability

| Task | FR | Slice |
|---|---|---|
| T1 | FR-001 (trigger arms), FR-002, FR-003 | 1 |
| T2 | FR-001 (same trigger), FR-004 | 2 |
| T3 | FR-005 | 2 |
| T4 | FR-006 | 3 |
| T5 | slice-3 validation | 3 |
