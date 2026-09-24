# WI-15 — Verification Record

## Candidate identity

| | |
|---|---|
| **Candidate** | `0035506` (HEAD at the time of writing) |
| **Source identity** | `eaf006e` — the last commit touching `src/` |
| **Base** | `39d1b26` (`main`) |
| **Branch** | `worktree-wi-15`, worktree `.claude/worktrees/wi-15` |
| **Range** | `39d1b26..0035506`, 10 commits |
| **Changed paths** | 7 — `CLAUDE.md`, `docs/work/WI-15/{evidence/label-state-probes.log,implementation-notes.md,implementation-plan.md,specification.md}`, `src/loop.test.ts`, `src/loop.ts` |

**What "source identity" means here, and why it is stated separately.** Four commits follow
`eaf006e` — the spec amendment `f988101`, the docs-hygiene fix `5bd9a8a`, the attribution fix
`c66e268`, and the checkpoint-3 acceptance `0035506` — and none touches a `src/` path. Verified
rather than asserted:

```
$ git log -1 --format='%H %s' -- src/
eaf006e624b9b7d3a5dc6b8917ab1254a00923a7 fix(wi-15): spec-review findings — label name in
  operator messages, doc scope, stdio evidence (FR-002, FR-005, FR-006)
$ git diff --stat 39d1b26...0035506 -- src/loop.test.ts src/loop.ts   # the whole src/ range
 src/loop.test.ts |  90 +++++++++++++++++++++++++++++++++++
 src/loop.ts      | 139 ++++++++++++++++++++++++++++++++++++++-----------------
 2 files changed, 186 insertions(+), 43 deletions(-)
```

So the code the gates below exercise is `eaf006e`'s, unchanged by every later commit. **This
record's own commit is likewise docs-only.**

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
| FR-001 | The removal decides from the issue's labels; a missing label is a no-op | `src/loop.ts:833` (`if (!labels.includes(HARNESS_FAILED_LABEL)) return {}`); test **(f)** `src/loop.test.ts:3769` — `readLabels: []` → `expect(deps.setIssueLabel).not.toHaveBeenCalled()` | pass |
| FR-001 | A source with no GitHub issue is neither read nor removed | `src/loop.ts:821-823` (the `url === undefined` guard precedes the read); test **(e)** `src/loop.test.ts:3757` — extended with `expect(deps.readIssueLabels).not.toHaveBeenCalled()` | pass |
| FR-002 | No error text is interpreted in the **removal** path | Diff-level deletion proof plus the regex sweep below (this section) | pass (diff-verified, not test-verified) |
| FR-002 | A failed removal on a confirmed-present label is recorded verbatim, never excused | `src/loop.ts:838-842` (bare call, no classifier); test **(d)** `src/loop.test.ts:3720` — throw recorded, `setIssueLabel` called exactly once (never retried), run green | pass |
| FR-003 | A throwing read is recorded verbatim, prefixed, and the removal skipped | `src/loop.ts:827-832` (reason `:830`, prefix `:831`); test **(g)** `src/loop.test.ts:3796` — `readLabelsThrows` → `setIssueLabel` not called, `escalationLabelFailure` equals `could not read the issue's labels: …` | pass |
| FR-004 | One field, one line, no new vocabulary | No field added — `git diff 39d1b26...0035506 -- src/loop.ts \| grep -E '^[-+].*LoopOutcome'` is **empty**, so the interface is untouched and `escalationLabelFailure` is only ever *used* in the diff, never declared; test **(g)** asserts the read failure on the **existing** lines — `src/loop.test.ts:3821` (`harness-failed label remove failed: …`) and `:3828` (`LABEL REMOVE FAILED gh-1: …`) | pass |
| FR-005 | One source of truth for the label name | `src/loop.ts:64` is the only non-comment occurrence of the literal in `src/` (sweep below) | pass (review-evidenced, structural) |
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

Enumerate every occurrence of the literal in `src/`, then classify each by hand rather than
trusting a filter to do it:

```
$ grep -rn "harness-failed" src/
```

| File | Occurrences | Classification |
|---|---|---|
| `src/loop.ts` | `:64` — `export const HARNESS_FAILED_LABEL = "harness-failed";` | **code — the single definition** |
| `src/loop.ts` | `:1958` — a `/** … */` JSDoc line | comment |
| `src/loop.test.ts` | `:156`, `:3563`, `:3576`, `:3614`, `:3620`, `:3631`, `:3662`, `:3695`, `:3744`, `:3792`, `:3821`, `:3846` | fixture and expected-output text |

**Exactly one non-comment occurrence in `src/loop.ts`, and it is the definition at `:64`.** The
first version of this sweep — `grep … | grep -vE ':\s*(\*|//)' | grep -c …` — was discarded: the
comment filter is leaky (`:1958`'s JSDoc has two spaces after the colon, so `\s*` then `\*` does
not match it and the line survives the filter), and counting lines that also contain
`HARNESS_FAILED_LABEL` would have returned `1` whether or not a stray literal existed. It agreed
with the right answer for the wrong reason, which is not evidence; the enumeration above is.

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
| (i) `docs/work/WI-6/evidence/canary-red-driver.ts:106` is uncompilable | **Deferred to the owner as a follow-up** — see Remaining risks |
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
   `expect(deps.setIssueLabel).not.toHaveBeenCalled()` (`src/loop.test.ts:3813`) beside
   `expect(report.stderr).toContain("harness-failed label remove failed: …")` (`:3821`). The reason
   text distinguishes the two cases; the line deliberately does not.
3. **Ask (g) — a negative assertion can pass vacuously.** `src/loop.test.ts:3792` asserts
   `not.toContain("harness-failed label remove failed:")` against a hard-coded name, so renaming
   `HARNESS_FAILED_LABEL` would leave *that* assertion passing without exercising anything. It sits
   inside the amended criterion's fixture carve-out, and the deferral is well-founded rather than
   convenient: sibling assertions pin the rendered text against hard-coded literals and would fail
   loudly on a rename — `src/loop.test.ts:3744` and `:3753` (`toContain("harness-failed label
   remove failed: gh: label remove failed — network")` and `toContain("LABEL REMOVE FAILED gh-1:
   …")`), `:3935`, and the template-prefixed `:3821`.
4. **Ask (i) — a pre-existing uncompilable file outside the build.** WI-6's
   `docs/work/WI-6/evidence/canary-red-driver.ts:106` is a `QueueLoopDeps` literal carrying neither
   `setIssueLabel` nor `readIssueLabels` (`grep -n 'setIssueLabel\|readIssueLabels'` → exit 1), so
   it has not compiled since WI-14 made `setIssueLabel` required. It is outside `tsconfig.json`'s
   `include` (`["src","scripts","vitest.config.ts"]`) and was last touched by `aa6f2e0` (WI-6):
   **pre-existing, unrelated to WI-15, and surfaced to the owner rather than fixed here.**
5. **The two current review verdicts describe `c66e268`, not this record's commit.** The
   specification PASS and the code-quality APPROVED both apply to `c66e268`; `0035506` is
   docs-only (three narration closures and the acceptance entry, none touching `src/`). By this
   ledger's own standard a later commit voids an earlier verdict, so the verdicts are recorded as
   describing `c66e268` and nothing later — and the prose after them is covered by the lifecycle's
   stage-4 `code-review` at final HEAD. This is stated rather than smoothed over because a record
   claiming otherwise would be WI-15's own defect class.
6. **`node_modules` is an untracked symlink in this worktree.** `.gitignore` carries
   `node_modules/` with a trailing slash, which matches real directories but not symlinks, so
   `git status --short` shows `?? node_modules`. It is not in the tree (`git ls-tree -r --name-only
   HEAD | grep -c '^node_modules'` → 0) and is not part of the range; noted so the delivery step
   can be read as intentionally clean rather than accidentally so.

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