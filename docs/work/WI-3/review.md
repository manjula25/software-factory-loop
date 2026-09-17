# WI-3 code review — two-axis (Standards + Spec)

Fixed point `bacb85a` (bacb85a065a7ac7396ef2988daa859dc11f7c7e1) → HEAD `a604ffd`
(19 commits, 20 files, +2187/−37). Both axes ran as parallel read-only sub-agents;
reports are aggregated verbatim below, not merged or reranked.

Standards sources: `CLAUDE.md` + `docs/agents/workflow.md` (no CODING_STANDARDS.md or
CONTRIBUTING.md exists in the repo) plus the 12-smell Fowler baseline. Spec source:
`docs/work/WI-3/specification.md` (FR-001–008), resolving against `harness-prd-v2.md`.

Controller note on output path: the code-review skill names `docs/plans/{PLAN_ID}/`
for its review record; this repo's convention is `docs/work/{WORK_ITEM}/` — this file
follows the repo convention.

## Standards

> Hard violation (documented standard): the loop command gained `--spec-doc` /
> `--plain-list` but `docs/agents/workflow.md` line 24 (the authoritative command
> list) was not updated in the same PR — verified by the controller (grep: no
> `spec-doc`/`plain-list` anywhere in workflow.md).
>
> Judgement-call smells: Duplicated Code — argv flag parsing in three near-identical
> shapes (`optFlag` in src/loop.ts:732, `optValue` in src/onboard-profile.ts,
> hand-rolled `indexOf` in `parseSourceArgs`); the slug-dedup counter block appears
> verbatim in both `parseSpecDoc` and `parsePlainList` (src/issues.ts).
> Mysterious Name — `assertClearedForAttachments(profile, urls, repoName)` declares
> `repoName: string` but src/loop.ts passes `input.repoDir` (a filesystem path), so
> the gate message names a local directory. Mysterious Name / duplicate call —
> scripts/onboard.ts builds a throwaway `pending` profile with dummy facts just to
> read `installCmd`/`testCmd`, then calls `onboardProfile` again. Minor —
> `attachmentFailures!` after a `(x ?? []).length > 0` guard instead of the repo's
> conditional-spread idiom (src/loop.ts).
>
> Clean: module table updated same-PR; Sandcastle import boundary held; no lint
> step invented; JSDoc/named-Error/conditional-spread style consistent.

Full sub-agent report preserved below.

---

**Verbatim sub-agent report (Standards axis):**

STANDARDS review of `git diff bacb85a...HEAD` in `.claude/worktrees/wi-3`.

### Hard violation (documented standard)

**1. Command surface changed without updating the authoritative command list.**
- CLAUDE.md: "The authoritative command list lives in `docs/agents/workflow.md` ... when a command changes, change it there."
- `docs/agents/workflow.md` line 24 documents the loop command as `npm run loop -- --repo <dir> --provider <name> [--model <m>] [--issue <n>] [--label <label>] [--max-issues <n>] [--triage]`. The diff adds `--spec-doc <path>` / `--plain-list <path>` to that command (src/loop.ts main(), commit 322bc00) but workflow.md is untouched. Not in the diff at all.
- Fix: add the two source flags (and the T5b exclusivity rule) to that workflow.md row in this PR.

### Standards checked, clean

- Module table updated in the same PR (`src/attachments.ts`, `src/onboard-profile.ts` rows added to CLAUDE.md) — rule followed.
- Sandcastle boundary: only `src/sandcastle-adapter.ts` imports `@ai-hero/sandcastle`; the adapter merely passes `copyToWorktree` through. Clean.
- No lint step invented. Clean.
- Style baseline: JSDoc on all new exports, conditional-spread property pattern used consistently, all four new error classes set `name`. Clean.

### Baseline smells (judgement calls)

- **Duplicated Code** — argv flag parsing now exists in three near-identical shapes: `optFlag` closure (src/loop.ts:732), `optValue` (src/onboard-profile.ts, moved out of scripts/onboard.ts), and hand-rolled `indexOf` in `parseSourceArgs` (src/loop.ts). Cross-module, so partly defensible, but the shape is identical.
- **Duplicated Code** — the slug-dedup counter block (`const count = (seen.get(slug) ?? 0) + 1; ... id: count === 1 ? ... : ...-${count}`) appears verbatim in both `parseSpecDoc` and `parsePlainList` (src/issues.ts). Extractable shared seam.
- **Mysterious Name / semantics mismatch** — `assertClearedForAttachments(profile, urls, repoName)` (src/attachments.ts) declares `repoName: string`, but src/loop.ts calls it with `input.repoDir`, so the gate message names a local directory path, not a repo like the tests' `"acme/client-web"`. Rename the param or pass the repo name.
- **Mysterious Name + duplicate call** — scripts/onboard.ts: `const pending = onboardProfile(argv, { baselineFailures: [], durationSec: 0 })` builds a throwaway profile with dummy facts just to read `installCmd`/`testCmd`, then calls `onboardProfile` again with real facts. `pending` names neither purpose; a smaller `parseOnboardArgs` would remove the dummy facts.
- **Minor** — `buildPrBody` uses `attachmentFailures!` after `(attachmentFailures ?? []).length > 0` instead of the repo's conditional-spread/local-variable idiom (src/loop.ts).
- **Minor inconsistency** — argv parsing for the loop CLI stays inline in src/loop.ts while onboarding argv parsing was extracted to its own module; the split is documented in the table, so this is taste, not a violation.

No blocking issues beyond the workflow.md omission.

## Spec

> Controller verification of the worst finding: CONFIRMED. `parsePlainList` strips the
> `| <value>` suffix from `description`; `src/loop.ts:283` runs
> `discoverAttachmentUrls(input.issue.description)` only; the FR-002 gate at :285 keys
> on that result; and `src/loop.ts:208` inlines `issue.attachedLog` into the fix prompt
> unconditionally. A user-attachments URL in a plain-list suffix therefore reaches the
> third-party API with the gate never firing — a hard-constraint-3 (confidentiality)
> breach, not a wording issue. Spec-doc is unaffected (its `log:` line stays in the
> body, where discovery scans).

**Verbatim sub-agent report (Spec axis):**

SPEC review, WI-3 (`git diff bacb85a...HEAD`, 19 commits). Verdict: substantially faithful; one genuine spec hole, two minor partials.

(a) Missing / partial
1. BLOCKING-ish gap — plain-list suffix URLs escape both discovery and the gate. FR-001: "For every admitted issue, regardless of source, the harness inspects the issue description… Discovery is the same for every source." `parsePlainList` (src/issues.ts) strips the `| <value>` suffix from `description`, and `runSingleIssue` (src/loop.ts) calls `discoverAttachmentUrls(input.issue.description)` only. So `text | https://github.com/user-attachments/x` is never discovered, never fetched (FR-003), and — because FR-002's gate keys on discovery — an uncleared repo carrying a user-attachments URL in the suffix bypasses `assertClearedForAttachments` while the raw URL is still inlined into the prompt sent to the third-party API. FR-002: "an uncleared repo must never look like a cleared one whose logs went missing." Not in any follow-up queue; spec-doc is unaffected (its `log:` line stays in the body).
2. FR-004's optional live case: matrix says "unit (+ pipeline-integration where feasible)" — T6 ran none and verification.md never records why infeasible. Unit coverage itself is solid (404, throw, isolation, summary + PR body).
3. FR-004 wording: "the run summary and the PR body… carry `attachment fetch failed: <url>`" — the PR body matches verbatim; `formatSummary` emits `ATTACHMENT FAILED <id>: <url>`. Cosmetic.

(b) Scope creep — none unrecorded. T2b (gitignore + "never commit `.loop-harness/`" prompt rule), T2c (directory-level `copyToWorktree`), T5b (flag-combination rejections), the punctuation strip, and the manual redirect re-fetch are all logged in implementation-notes.md with review cycles and map to "Loud over silent" / constraint 3. CLAUDE.md module rows follow its same-PR rule.

(c) Implemented but questionable
1. The plain-list bypass above.
2. FR-005 non-claim: "code fences inside a section are just description text" — yet `^## ` inside a fence starts a new issue (regex has no fence awareness). Recorded as T3 follow-up 2, unresolved.
3. "path-or-url": the path half has no behavior — a local `log:`/`| path` value is only echoed as prompt text, never read. Spec is silent; worth a grilling note.
4. Slug/suffix ambiguity (`spec-foo-2` from collision vs literal "Foo 2") correctly deferred with a named owner.

Traceability matrix: accurate — every FR's evidence label exists (FR-003/FR-008 live runs = PRs #12/#13; no-auth mechanically asserted per hop, src/attachments.test.ts:149) except FR-004's "where feasible" live case (finding a2).

## Axis summaries (separate by design — no cross-axis ranking)

- **Standards:** 1 hard violation (workflow.md command list not updated same-PR — verified) + 6 judgement-call smells. Worst: the workflow.md omission.
- **Spec:** 1 blocking gap + 2 partials + 3 questionable-but-recorded. Worst: the plain-list suffix URL bypasses the FR-002 confidentiality gate while reaching the prompt — controller-verified CONFIRMED.

## Disposition

Both worst findings are **blocking** under the lifecycle (standards hard violation;
hard-constraint-3 breach) and send the branch back to stage 3 (implement) before
`finishing-a-development-branch`:

1. **Gate/discovery fix (blocking):** discovery (and therefore the FR-002 gate and
   FR-003 fetch) must see plain-list suffix URLs — e.g. scan the full pre-strip line
   or `description + attachedLog` — with tests pinning: suffix URL in an uncleared
   repo refuses with zero spend; suffix URL in a cleared repo fetches and stages.
2. **workflow.md update (blocking):** add `--spec-doc <path>` / `--plain-list <path>`
   (and the T5b exclusivity rules) to the loop command row — the same-PR rule, in
   the same PR.

Judgement-call smells and the remaining partials (FR-004 live case, summary wording)
are follow-up material, not blocking; several were already queued in
implementation-notes.md. New items from this review to queue: argv-parsing
triplication, slug-dedup counter duplication, `repoName`-vs-`repoDir` param mismatch,
`pending` throwaway profile, `attachmentFailures!` idiom, "path half of
path-or-url has no behavior" (grilling note).

## Resolution (2026-09-17)

Both blocking findings resolved by **T7, candidate `01b2b04`** (full checkpoint
cycle: leaf TDD → controller inspection → sequential spec review PASS + quality
review APPROVED on that identity; evidence in verification.md and
implementation-notes.md):

1. Gate/discovery fix — the plain-list `attachedLog` joins the discovery scan
   (source-conditional, rationale-commented); uncleared+suffix-URL refusal and
   cleared+suffix-URL fetch both pinned at the spend seam; GitHub/spec-doc
   behavior pinned unchanged.
2. workflow.md — the loop command row now documents `--spec-doc <path>` /
   `--plain-list <path>` and their exclusivity rules, traced accurate against
   `parseSourceArgs` by the spec review.

Branch green at `01b2b04`: typecheck exit 0, 129/129 tests, clean tree.
