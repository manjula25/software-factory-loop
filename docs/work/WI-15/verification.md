# WI-15 — Verification Record

## Candidate identity

| | |
|---|---|
| **Gates run at** | `0035506` — the completion gates below were executed here |
| **First review candidate** | `5946199` — the four stage-4 review axes first ran here |
| **Re-review candidate** | `d54d8ae` — all four axes re-ran here after the first corrections |
| **Source identity** | `eaf006e` — the last commit touching `src/` **within the delivered range** |
| **Base** | `39d1b26` (`main`) |
| **Branch** | `worktree-wi-15`, worktree `.claude/worktrees/wi-15` |
| **Range at `0035506`** | `39d1b26..0035506`, 10 commits, **7** changed paths — `CLAUDE.md`, `docs/work/WI-15/{evidence/label-state-probes.log,implementation-notes.md,implementation-plan.md,specification.md}`, `src/loop.test.ts`, `src/loop.ts` |
| **Range at `5946199`** | `39d1b26..5946199`, 11 commits, **8** changed paths — the seven above plus `docs/work/WI-15/verification.md`, this file |

The path count moves by one because a verification record cannot count its own commit: at
`0035506` this file did not yet exist. The range and path list are given for the gate candidate and
for the first review candidate rather than as a single figure, so neither reads as a claim about a
tree it did not describe.

**No row names a "current candidate."** A record cannot cite the commit that contains it, so such a
row is either a placeholder or a self-reference: the first version of this table carried one, and
the standards and complexity axes both flagged it independently at `d54d8ae`. Counts are given only
for candidates this record can name. Every commit after `5946199` **within the delivered range** is
docs-only and adds one commit but no new path, so re-derive the current figures rather than reading
them here:

```
$ git log --oneline 39d1b26..HEAD | wc -l
$ git diff --name-only 39d1b26...HEAD | wc -l
```

**What "source identity" means here, and why it is stated separately.** A growing run of docs-only
commits follows `eaf006e` — beginning with the spec amendment `f988101`, the docs-hygiene fix
`5bd9a8a`, the attribution fix `c66e268`, and the checkpoint-3 acceptance `0035506`, then the
verification record `5946199`, the corrections `d54d8ae`, and this record's own commit — and none
touches a `src/` path **within that range**. Verified rather than asserted:

```
$ git log -1 --format='%H %s' -- src/
eaf006e624b9b7d3a5dc6b8917ab1254a00923a7 fix(wi-15): spec-review findings — label name in
  operator messages, doc scope, stdio evidence (FR-002, FR-005, FR-006)
$ git diff --stat 39d1b26...0035506 -- src/loop.test.ts src/loop.ts   # the whole src/ range
 src/loop.test.ts |  90 +++++++++++++++++++++++++++++++++++
 src/loop.ts      | 139 ++++++++++++++++++++++++++++++++++++++-----------------
 2 files changed, 186 insertions(+), 43 deletions(-)
```

So the code the gates below exercise is `eaf006e`'s, unchanged by every later commit **in the
delivered range**. **This record's own commit is likewise docs-only.**

*Corrected 2026-09-24.* The source-identity row, the "every commit after `5946199` is docs-only"
sentence, the "none touches a `src/` path" clause and the sentence above previously stood
**unqualified**. They were true of the range they were measured on — `39d1b26..cd6e547`, the WI-15
delivery — but the follow-up branch `wi-15-followup` then changed `src/` itself: `72faee7` deletes
two assertions from `src/loop.test.ts` (the delivery record's risk 5). Read unqualified against the
current branch, all four are false, and the command this record prints proves their opposite:

```
$ git log -1 --format='%H %s' -- src/      # at the delivered tip cd6e547
eaf006e … fix(wi-15): spec-review findings …
$ git log -1 --format='%H %s' -- src/      # at the follow-up tip
72faee7 test(wi-15): drop the duplicate and subsumed assertions the review flagged
```

**What this does and does not change.** The gates below were run at `0035506` against `eaf006e`'s
`src/` tree, and that is still exactly what they evidence. What no longer holds is the extension of
that evidence to the branch as it now stands: `src/loop.test.ts` has since changed, so these gates
are **not** fresh for the follow-up tree. The follow-up re-ran the suite at its own tip —
`npm test` → 285 passed (10 files), exit 0 — and that run, not this record, is the evidence for the
follow-up tree.

## Claim

WI-15's FR-001..FR-006 are implemented on `worktree-wi-15` at candidate `0035506`: the label
removal decides from the issue's current label set instead of from subprocess error text, a
missing label is success by not calling, a failed read is recorded verbatim and skips the removal,
one field and one line carry both failures with no new vocabulary, the label's name is defined
once, and the docs match the code. Verification is the reproduction tests plus the full suite
re-run fresh at this identity.

## Completion gates — run fresh at `0035506`

Commands are the authoritative ones in `docs/agents/workflow.md` (Repository commands). Run from
the worktree root. No command is invented, and **no lint step exists or is added**
(`grep -n 'lint' package.json` → exit 1, no match).

| Command | Exit | Observed |
|---|---|---|
| `npm run typecheck` | **0** | `tsc --noEmit`, no diagnostics |
| `npx vitest run src/loop.test.ts` | **0** | `Test Files 1 passed (1)` / `Tests 164 passed (164)` |
| `npm test` | **0** | `Test Files 10 passed (10)` / `Tests 285 passed (285)` |

Baseline for comparison (`implementation-plan.md`, recorded at `0d371ef`): typecheck exit 0;
focused 162 tests; full 283 tests, 10 files. WI-15 adds exactly 2 focused tests and 2 full-suite
tests, and changes no existing assertion.

**Reading the output honestly.** The vitest runs print `fatal: Not possible to fast-forward,
aborting.` and `! [rejected] main -> main (non-fast-forward)` on stderr. These are **not failures
and not WI-15's**: they are emitted by the queue's acquisition-time sync fixture at
`src/loop.test.ts:1502`, which builds a deliberately diverged upstream in a `syncmain-*` temp dir to
exercise the non-fast-forward sync arm. Both runs exit 0 and every file reports passed. No skip,
no `todo`, and no unfiltered warning appears in either run.

## FR → evidence map

Line references are to the candidate. Tests are at the public seam (`runSingleIssue` /
`runQueue` / `formatSummary` / `formatSingleIssueResult`) and are dep-injected, never source-text
assertions.

| FR | Claim | Proving evidence | Result |
|---|---|---|---|
| FR-001 | The removal decides from the issue's labels; a missing label is a no-op | `src/loop.ts:833-836` (`if (!labels.includes(HARNESS_FAILED_LABEL)) {` at `:833`, `return {};` at `:836`); test **(f)** `src/loop.test.ts:3769` — `readLabels: []` → `expect(deps.setIssueLabel).not.toHaveBeenCalled()` | pass |
| FR-001 | A source with no GitHub issue is neither read nor removed | `src/loop.ts:821-823` (the `url === undefined` guard precedes the read); test **(e)** `src/loop.test.ts:3757` — extended with `expect(deps.readIssueLabels).not.toHaveBeenCalled()` | pass |
| FR-002 | No error text is interpreted in the **removal** path | Diff-level deletion proof plus the regex sweep below (this section) | pass (diff-verified, not test-verified) |
| FR-002 | A failed removal on a confirmed-present label is recorded verbatim, never excused | `src/loop.ts:838-842` (bare call, no classifier); test **(d)** `src/loop.test.ts:3720` — throw recorded, `setIssueLabel` called exactly once (never retried), run green | pass |
| FR-003 | A throwing read is recorded verbatim, prefixed, and the removal skipped | `src/loop.ts:827-832` (reason `:830`, prefix `:831`); test **(g)** `src/loop.test.ts:3796` — `readLabelsThrows` → `setIssueLabel` not called, `escalationLabelFailure` equals `could not read the issue's labels: …` | pass |
| FR-004 | One field, one line, no new vocabulary | No field added — the interface body is unchanged apart from JSDoc: `diff <(git show 39d1b26:src/loop.ts \| sed -n '/^export interface LoopOutcome/,/^}/p') <(sed -n … src/loop.ts)` differs **only** in the amended comment, and `grep -c readonly` is **22** on both sides. The field is only ever *used* in the range: `git diff 39d1b26...0035506 -- src/loop.ts \| grep -E '^[-+].*escalationLabelFailure'` → **7** changed lines, all uses (one new return, three operator strings re-pointed at the constant), none a declaration. Test **(g)** asserts the read failure on the **existing** lines — `src/loop.test.ts:3821` (`harness-failed label remove failed: …`) and `:3828` (`LABEL REMOVE FAILED gh-1: …`) | pass |
| FR-005 | One source of truth for the label name | `src/loop.ts:64` is the only non-comment occurrence of the literal in **`src/loop.ts`**; the 16 occurrences in `src/loop.test.ts` are 5 **comments** and 11 fixture/expected-output lines, both categories the amended criterion excludes (full enumeration below) | pass (review-evidenced, structural) |
| FR-006 | Docs honesty in the same delivery | `CLAUDE.md:31` (module row) and `:159-160` (two `## Lessons` lines), both in the range; `docs/agents/workflow.md` untouched | pass (review-evidenced) |

### FR-002's absence claim — the proving sweep (ask (a))

The plan's ask (a) is that this claim record a **proving command**, not an assertion. The
falsifiable form is: enumerate *every* regex-vs-string test in the file, then locate each one.

```
$ grep -nE '\.test\(|\.match\(|RegExp' src/loop.ts
486:  if (!SUITE_SUMMARY_RE.test(stdout)) {
2978:  if (last === undefined || !/^\d+$/.test(last)) {
3008:    if (!/already exists/i.test(errText)) {
```

Three hits, and the sweep is **non-vacuous** — it finds things. Their enclosing functions, read
from the file rather than assumed:

| Line | Enclosing function | In the label removal path? |
|---|---|---|
| `:486` | `parseSuiteOrReject` (`:485`) — the verification gate over sandbox output | no |
| `:2978` | `issueNumberFromUrl` (`:2976`) | no |
| `:3008` | `ensureHarnessFailedLabel` (`:2998`) — **label creation**, the deliberate exception (prd decision 5) | no |

**Zero in the removal path.** Confirmed structurally as well as by sweep: `setIssueLabel`
(`:2761-2769`) and `readIssueLabels` (`:2782-2789`) contain no `try`, no `catch`, no `errText`, and
no membership test against an error string — `setIssueLabel`'s body is a bare `execFileSync`
(`:2763`) with `stdio: ["ignore", "inherit", "pipe"]` at `:2766`, and `readIssueLabels` pipes
stdout at `:2786` and returns `JSON.parse(raw).labels.map((l) => l.name)` at `:2788`. The two
`try` blocks that *do* exist in the label path are `clearHarnessFailedLabel`'s
(`:825`, `:838`), and both catch to record a reason rather than to classify one.

The deletion itself, at the diff level:

```
$ git diff 39d1b26...0035506 -- src/loop.ts | grep -E '^[-+].*(errText|\.test\()'
-        const errText =
-        if (op === "remove" && /not found|not present|does not exist|could not remove|couldn't remove/i.test(errText)) {
```

The removed classifier matched five phrases, guarded on `op === "remove"` — the exact reachable
forgiveness the grilling probed. The `errText` occurrences remaining at `:3006`/`:3008` are inside
`ensureHarnessFailedLabel` (creation), not the removal path.

### FR-005's sweep

Enumerate every occurrence of the literal, then classify each — rather than trusting a filter to do
the classifying:

```
$ grep -rn "harness-failed" src/ | wc -l
29
$ grep -rc "harness-failed" src/ | grep -v ':0'
src/loop.ts:13
src/loop.test.ts:16
```

All 29, accounted for:

| File | Lines | Count | Classification |
|---|---|---|---|
| `src/loop.ts` | `:64` | 1 | **code — the single definition** |
| `src/loop.ts` | `:225`, `:318`, `:782`, `:800`, `:1157`, `:1228`, `:1664`, `:1826`, `:1958`, `:2198`, `:2751`, `:2985` | 12 | comment / JSDoc |
| `src/loop.test.ts` | `:156`, `:281`, `:1857`, `:3557`, `:3652` | 5 | comment |
| `src/loop.test.ts` | `:3563`, `:3576`, `:3614`, `:3620`, `:3631`, `:3662`, `:3695`, `:3744`, `:3792`, `:3821`, `:3846` | 11 | fixture and expected-output text (8) and `describe(…)` suite titles (3 — `:3563`, `:3662`, `:3846`) |

**Exactly one non-comment occurrence in `src/loop.ts`, and it is the definition at `:64`.**

**Correction, 2026-09-24 — this section's first version was not the enumeration it claimed to be.**
It printed `grep -rn "harness-failed" src/` above a 14-row table whose rows were in fact the output
of `grep … | grep -vE ':\s*(\*|//)'` — the very filter the surrounding prose declared inadmissible.
The two do not correspond: the command yields **29** lines, the table held **14**. The 15 omitted
were 11 `src/loop.ts` comment lines and 4 `src/loop.test.ts` comment lines; the table's `:1958` row
was itself a line that filter failed to drop. Nothing inside the table signalled those omissions —
the filter's output carries no marker that it dropped anything, so as an artifact the table read as
complete, and only running the command it printed against the tree exposes the 29-vs-14 gap. A check
that cannot fail is not evidence: this work item's own defect class, committed inside the record that
certifies the work. The evidence-and-risk review at `5946199` found it by running the command.
**No conclusion changes:** that reviewer re-derived the same result
independently from `grep -rn "harness-failed" src/loop.ts` read line by line, and the enumeration
above is that check performed in full.

The literal survives in comments, JSDoc and test fixtures, which the amended criterion (see
`specification.md` `## Amendments`) names as documentation and fixture text and excludes
deliberately. The four operator-facing message sites interpolate the constant:
`src/loop.ts:2207` (the FAILED-line suffix), `:2528` and `:2564` (the single-issue report lines),
and `:3011` (the create-time console line), which already did.

## Unknowns — reconciled

The carried asks (a)–(i) from `implementation-notes.md`, plus (j) and (k) added at the checkpoint-3
acceptance.

| Ask | Disposition |
|---|---|
| (a) FR-002's absence claim needs a proving command | **Closed** — the sweep above, in this record |
| (b) FR-005 scoped to production code, fixtures keeping the literal | **Closed by the amendment** — the criterion now says so explicitly |
| (c) FR-002's title-vs-behaviour tension over the kept create-time check | **Closed by the amendment** — the title is narrowed and the boundary names the exception |
| (d) The spec's "five recorded probe commands" vs nine blocks | **Closed by the amendment** — the spec's evidence boundary now says "nine blocks in two sets … plus a local `stdio` reproduction" |
| (e) The `build:image`/`smoke:image`, wiring-unexercised, and no-live-run non-claims | **Closed** — all three stated under Explicit non-claims below |
| (f) A read failure renders on the removal lines though no removal was attempted | **Closed** — recorded under Remaining risks, with the test that pins it |
| (g) The deferred test-fixture vacuity at `src/loop.test.ts:3792` | **Deferred, well-founded** — see Remaining risks |
| (h) FR-003's last criterion is live-only | **Stated, not omitted** — under Explicit non-claims |
| (i) `docs/work/WI-6/evidence/canary-red-driver.ts:114` is uncompilable | **Resolved 2026-09-24** — owner chose (b): labelled in place as a historical artifact, records corrected here and in `implementation-notes.md` |
| (j) `src/loop.test.ts:3813`/`:3817` assert the same value twice | **Deferred deliberately** — a `src/` edit would void the two current verdicts for a cosmetic duplicate |
| (k) FR-006 asked for one `## Lessons` line and two landed | **Recorded, not scope creep** — both are true and both concern this work item's defect classes |

## Remaining risks

1. **Two `gh` subprocess calls are never exercised by vitest.** `readIssueLabels`
   (`src/loop.ts:2782-2789`) and `setIssueLabel` (`:2761-2769`) are production wiring. Their
   correctness rests on code review plus the recorded probes in `docs/work/WI-15/evidence/`, not on
   a behavioral test. Stated as a non-claim below.
2. **The read-failure rendering is deliberate and slightly counter-intuitive (ask (f)).** A failed
   **read** renders on lines that say *remove failed*, even though no removal was attempted —
   because FR-004 requires one field and one line. Test **(g)** pins both halves at once:
   `expect(deps.setIssueLabel).not.toHaveBeenCalled()` (`src/loop.test.ts:3812`) beside
   `expect(report.stderr).toContain("harness-failed label remove failed: …")` (`:3821`). The reason
   text distinguishes the two cases; the line deliberately does not.
3. **Ask (g) — a negative assertion can pass vacuously.** `src/loop.test.ts:3792` asserts
   `not.toContain("harness-failed label remove failed:")` against a hard-coded name, so renaming
   `HARNESS_FAILED_LABEL` would leave *that* assertion passing without exercising anything. It sits
   inside the amended criterion's fixture carve-out, and the deferral is well-founded rather than
   convenient: sibling assertions pin the rendered text against hard-coded literals and would fail
   loudly on a rename — `src/loop.test.ts:3744` and `:3753` (`toContain("harness-failed label
   remove failed: gh: label remove failed — network")` and `toContain("LABEL REMOVE FAILED gh-1:
   …")`), `:3933`, and the template-prefixed `:3819`.

   *Corrected 2026-09-24 — the last two previously read `:3935` and `:3821`. This record was written
   at `0035506`; the follow-up branch's `72faee7` then deleted two assertions at `:3814`/`:3817`, so
   every line below the cut moved up by two. `:3744`/`:3753` sit above it and are unaffected.
   Re-measured, not adjusted by arithmetic: `sed -n '3819p;3933p' src/loop.test.ts` returns the
   template-prefixed assertion and the `LABEL REMOVE FAILED` one. Same correction, same cause, as
   risk 3 in `delivery.md`.*
4. **Ask (i) — a pre-existing uncompilable file outside the build.** WI-6's
   `docs/work/WI-6/evidence/canary-red-driver.ts:114` is a `QueueLoopDeps` literal that still carries
   the two properties WI-13 retired (`runTriage`, `triage`) and is missing **eight** required deps
   added since: `branchConflictsWithMain`, `commentOnIssue`, `pushBranch`, `readIssueLabels`,
   `refreshRemoteRefs`, `runMerger`, `runPlan`, `setIssueLabel` — six from `LoopDeps`, one from
   `QueueDeps` (`refreshRemoteRefs`, since WI-7), one from the inline `runPlan` constituent. It is
   outside `tsconfig.json`'s `include` (`["src","scripts","vitest.config.ts"]`) and was last touched
   by `aa6f2e0` (WI-6) at the PR head `cd6e547`: **pre-existing and unrelated to WI-15.**
   *Corrected 2026-09-24 — this entry previously said the literal carried "neither `setIssueLabel`
   nor `readIssueLabels`" and had "not compiled since WI-14". It carries two of the eight, and it
   broke at WI-13 (`cca5e53`), which retired `--triage`; that commit's deleted-property errors are
   the ones a compiler prints first, and TypeScript hides the missing deps behind them. It then said
   **six**, which is the count TypeScript reports — an intersection failure is reported through one
   constituent only, and the list is truncated ("…and 2 more"). Enumerating all three constituents
   against the literal's keys gives eight; proving commands are in `delivery.md` risk 4 and the
   correction note in `implementation-notes.md`.*
5. **The checkpoint verdicts describe `c66e268`, and the stage-4 verdicts describe `d54d8ae`.**
   The specification PASS and the code-quality APPROVED both apply to `c66e268`; `0035506` is
   docs-only (three narration closures and the acceptance entry, none touching `src/`). By this
   ledger's own standard a later commit voids an earlier verdict, so those two are recorded as
   describing `c66e268` and nothing later. The lifecycle's stage-4 `code-review` then ran at
   `5946199` (three PASS, evidence/risk FAIL) and was re-run at `d54d8ae` (four PASS) — those
   verdicts, and the corrections that postdate them, are recorded in `review.md`. This is stated
   rather than smoothed over because a record claiming otherwise would be WI-15's own defect class.
6. **`node_modules` is an untracked symlink in this worktree.** `.gitignore` carries
   `node_modules/` with a trailing slash, which matches real directories but not symlinks, so
   `git status --short` shows `?? node_modules`. It is not in the tree (`git ls-tree -r --name-only
   HEAD | grep -c '^node_modules'` → 0) and is not part of the range; noted so the delivery step
   can be read as intentionally clean rather than accidentally so.

## Corrections applied after review (2026-09-24)

### Round 1 — the stage-4 review at `5946199`, and the corrections in `d54d8ae`

The stage-4 review ran four axes at candidate `5946199`. Three returned PASS; the
**evidence-and-risk-integrity axis returned FAIL** on one blocking finding — the FR-005 sweep above,
which presented a filtered result as a hand-classified full enumeration. The conclusion was
independently re-derived and holds, so no code changed. The corrections landed in `d54d8ae`, a
docs-only commit: **one path below is in `specification.md`, not in this artifact**, and the row for
it is present because an earlier version of this paragraph claimed every correction was here, which
was itself an understatement of the same kind this section exists to record.

| Correction | Where | Found by |
|---|---|---|
| The FR-005 sweep rebuilt as a real 29-occurrence enumeration, with the false claim about it recorded rather than quietly replaced | `### FR-005's sweep` above | the evidence/risk axis (blocking) |
| FR-005's evidence row said "the only non-comment occurrence … in `src/`"; true of `src/loop.ts`, false of all of `src/` | FR → evidence map | the evidence/risk axis |
| `src/loop.ts:833` cited for text spanning two lines; the `return {}` is at `:836` | FR → evidence map | the evidence/risk axis |
| `expect(deps.setIssueLabel).not.toHaveBeenCalled()` cited at `src/loop.test.ts:3813`; it is at **`:3812`** (`:3813` is the `escalationLabelFailure` assertion) | Remaining risk 2 | the controller, from a line-numbered `grep` after deriving the pointer from a ranged `sed` |
| The identity table's range/path counts restated per candidate, and the "Corrected candidate" row added | `## Candidate identity` | the controller, on a reviewer's observation that a single figure described no single tree |
| `## Amendments`' enumeration completed from three edits to all five, with the authority for each named | `specification.md` (**not this file**) | the specification-fidelity axis |

The pointer row is the same class of error as the first: a pointer produced by a looser method than
the one claimed. It is listed separately only because the reviewer did not find it; and it is a third
instance of the pattern this work item keeps meeting — a check that could not have failed, a filter
that agreed for the wrong reason, and a pointer derived from a range instead of a line.

### Round 2 — all four axes re-run at `d54d8ae`, and the corrections below

`d54d8ae` was docs-only, so all four axes reviewed the same `eaf006e` source identity and all four
returned **PASS**; the evidence/risk axis confirmed the remedy by running the command itself (29
lines), reproducing the filter's 14 survivors and the 15 omitted, and reproducing the RED in a
throwaway copy (`2 failed | 162 passed (164)`, failing at the `setIssueLabel` assertion, no compile
error). Six adjacent findings were raised, none blocking, all in this artifact:

| Correction | Where | Found by |
|---|---|---|
| The FR-005 evidence row called all 16 `src/loop.test.ts` occurrences "fixture string literals"; 5 are comments | FR → evidence map | the evidence/risk axis; the specification-fidelity axis flagged it independently |
| The corrections table omitted two of `d54d8ae`'s corrections (the `specification.md` enumeration and the identity-table counts) while the prose called the list complete | this section | the evidence/risk axis |
| A sentence stated the **opposite** of this section's own finding — that the old table "could not have been incomplete", when the finding is that it *was* incomplete (14 of 29) | `### FR-005's sweep` above | the evidence/risk axis |
| FR-004's proving command (`grep -E '^[-+].*LoopOutcome'`) could not detect a field added inside the interface body; replaced with an interface-body diff plus the field-usage grep | FR → evidence map | the evidence/risk axis |
| The identity table's "Corrected candidate" row could not name its own commit and went stale for any later reader; rows are now given only for candidates the record can name, with the re-derivation commands | `## Candidate identity` | the complexity and standards axes, independently |
| The 11-line fixture bucket labelled three `describe(…)` suite titles as fixture text | `### FR-005's sweep` above | the evidence/risk axis |

**This round's corrections are themselves un-reviewed.** They postdate the four verdicts, exactly as
round 1's did — a record cannot be reviewed by the round that produced it. Rather than a third full
four-axis pass over a docs-only delta, the evidence/risk axis is asked to re-check only the rows it
found, and its answer is recorded in `review.md` beside the four verdicts. Stated here because a
record claiming its own corrections were reviewed would be this work item's defect class once more.

## Explicit non-claims

- **No live run was bought** (prd decision 7). Nothing in this work item executed the harness
  end-to-end against a seeded buggy repo. The label read and removal were never run through the
  real `gh` paths by this change; the recorded probes are the boundary.
- **`npm run build:image` and `npm run smoke:image` were deliberately not run.** No `Dockerfile`
  and no `scripts/` path is in the range (`git diff --name-only 39d1b26...0035506 | grep -E
  'Dockerfile|^scripts/'` → exit 1), so the image result is candidate-independent. This is a
  non-claim, not a pass; the owner may override it.
- **Docker was not engaged anywhere in this change** (hard constraint 6 is untouched).
- **FR-002's "no error-text matching remains" is diff-verified, not test-verified.** No behavioral
  test can prove the absence of a deleted classifier; the sweep and the diff hunk are the evidence.
- **FR-005 is review-evidenced**, not behaviorally tested — it is a structural constraint.
- **FR-003's last success criterion is live-only.** "the label remains on the issue and the next
  successful run attempts the removal again" (`specification.md:70-71`) cannot be shown by
  dep-injected vitest. It follows by construction from "no removal call is made", and it falls
  inside the declared no-live-run boundary. Stated here rather than omitted.
- **No command surface changed.** `docs/agents/workflow.md` is not in the range and no lint step
  exists or was added.
- **Hard constraint 1 is untouched.** No merge, review, canary, revert, or push behavior changes;
  this work item is delivery-neutral. Nothing has been pushed and `main` is untouched.
- **Two evidence-log probes exceeded their authorization.** The `cli/cli` probes
  (`docs/work/WI-15/evidence/label-state-probes.log:88-150`) were read-only `gh issue` reads against
  a public, non-client repository, both recorded in the log as **not pre-authorized**. Hard
  constraint 3 is not engaged — no client repo, issue list or log is wired in anywhere in this
  change — and the deviation is surfaced to the owner rather than buried.

## Approval to proceed

Gates are green and fresh at `0035506`; every carried ask is closed, deferred with a reason, or
stated as a non-claim; no blocking review finding remains open. Next is `code-review`, then
`finishing-a-development-branch`. Delivery is a PR and **this repository keeps human merge** — the
harness never merges its own repo (hard constraint 1). No push, PR, or merge is prepared or
authorized by this record.