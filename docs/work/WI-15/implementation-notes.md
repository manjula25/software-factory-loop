# WI-15 — Implementation notes (controller ledger)

Created 2026-09-23, when implementation began. Evidence, never requirements: the approved
artifacts are `prd.md`, `slices.md`, `specification.md`, `implementation-plan.md`.

## Setup (recorded before the first dispatch)

- **Base:** `main` @ `0d371ef`. **T0** landed the planning-chain inputs on `main` as `39d1b26`
  (owner's plan approval; not pushed — pushing is a separate authorized action).
- **Worktree:** `.claude/worktrees/wi-15`, branch `worktree-wi-15`, forked from `39d1b26`.
  `node_modules` is symlinked to the main checkout's (`../../../node_modules`, gitignored);
  no `npm install` was run and no `.env` was copied (no live run is bought — decision 7).
- **Baseline at `39d1b26`, run in the worktree:** `npm run typecheck` exit 0;
  `npx vitest run src/loop.test.ts` exit 0 — **162 passed**; `npm test` exit 0 — **283 passed**,
  10 files. Matches the plan's expected baseline exactly.

## Controller decisions and refinements

- **Dispatch granularity.** The plan's five tasks were grouped into three bounded dispatches —
  T1+T2 (the no-behavior-change preparation: constant, then the read seam), T3 (the behavior
  change, with its RED), T4 (docs). T5 stays the `verification-before-completion` step and is
  not an implementation dispatch. Reason: T1 and T2 are mechanical and carry no RED to observe;
  a dispatch per four-line edit would spend more than the work item costs.
- **Plan refinement (recorded, not silent):** `docs/work/WI-15/evidence/label-state-probes.log`
  is **created at T2 step 1**, when the shape probe is actually run — evidence that exists only
  in a transcript is not durable. T4 appends the five earlier probes and the explanatory lines,
  so the plan's T4 outcome (one complete log) is unchanged.

## Checkpoint ledgers

### Checkpoint 1 — T1 + T2 (the constant and the read seam)

**Status: ACCEPTED** at candidate `9970111f87447aabf9969dbdf4376a3106086e95` — spec review PASS,
then code-quality review APPROVED (no critical, no important findings), both against that exact
identity. Focused GREEN re-run by the controller at the same identity: typecheck exit 0,
162/162.

**Controller pre-check before T3** (so T3's expected count is not a guess): no existing test
encodes the old classifier's forgiveness — grepping `src/loop.test.ts` for the classifier's
phrases (`not found`, `not present`, `does not exist`, `could not remove`, `idempoten`,
`swallow`) returns only two unrelated hits (`:2049`, `:3085`). So T3's arithmetic holds: 162 + 2
new tests = **164**, with no existing assertion rewritten.

**Quality reviewer's minor findings and dispositions** (all adjacent, none blocking):

| # | Finding | Disposition |
|---|---|---|
| 1 | `src/loop.ts:63` — the constant's comment names a "membership check" that does not exist until T3 | **No action.** T3 lands the membership check in the very next commit, after which the comment is accurate; rewording it now would make it inaccurate in the other direction. |
| 2 | `src/loop.ts:~2757` — "caught by checkpoint 1's spec review, reproduced locally" is process narration where neighbours cite WI/FR numbers | **Fixed at T3, as an explicitly bounded controller-directed edit** (recorded there, not silent scope expansion): the durable mechanism stays, the review-history narration goes. |
| 3 | Probe 2 shows a filtered result under "Verbatim result" with no command; header says "probes 1–3" for four blocks | **Assigned to T4**, which owns the evidence file. |
| 4 | `docs/work/WI-15/implementation-plan.md:100` still prints the buggy `stdio: ["ignore", "inherit", "pipe"]` — re-executing T2 from the plan would re-seed the defect | **Assigned to T4** (docs honesty). This one matters: the approved plan is the artifact a future implementer would follow. |

- **Commits:** `9c19268` (T1, `src/loop.ts` only) → `6ec5c5b` (T2, three files). Base for the
  range: `39d1b26`. Nothing pushed.
- **Candidate inspected by the controller** (not accepted from the report): the `src/loop.ts`
  diff replaces all three literal sites with the exported constant, adds the `LoopDeps` member
  and the real wiring; the `src/loop.test.ts` diff is additive only — two knobs and two fakes,
  no existing assertion touched.
- **Focused GREEN re-run by the controller at `6ec5c5b`** (independently, not from the
  implementer's report): `npm run typecheck` exit 0; `npx vitest run src/loop.test.ts` exit 0 —
  **162 passed (162)**. Matches baseline, as a no-behavior-change candidate must.
- **Review package:** base `39d1b26aa3c839f0c0e935e44a9c1a8a40b716c3`, candidate
  `6ec5c5b1064967bc63a63efb1b778a03f03aead3`, three changed paths accounted for.
  **Superseded:** the spec review of that candidate returned FAIL (one blocking finding, below);
  the fix amended the T2 commit, so the candidate is now
  **`9970111f87447aabf9969dbdf4376a3106086e95`** and both reviews were rerun against it. The
  original verdicts do not carry forward.

**Deviation recorded — probes beyond the briefed scope.** The brief authorized exactly one
read-only probe, on the fixture repo `manjula25/loop-fixtures-py`. That probe returned five
issues with **empty** `labels` arrays, so it could not answer the question it exists to answer
(the shape of an array *element*). The implementer then ran two further read-only probes on
**`cli/cli`** — a public repository no part of the plan named — to observe that shape, and a third
confirming the exact `gh issue view --json labels` invocation. Read-only, public, non-client (hard
constraint 3 not engaged, and no credential or private data involved), and it served the brief's
own instruction to observe rather than assume — the alternative was to pick `{name}` from recall,
which is the precise defect class this work item removes. **Accepted, but surfaced to the owner
rather than buried**, because it is an outward-facing action against a repo the plan did not name.
The evidence log records the fixture probe's emptiness as the reason, and labels probe 1
**inconclusive on the element shape** rather than presenting it as settled.

**Blocking defect found by checkpoint 1's spec review — reproduced and fixed by the controller.**
The finding was that `readIssueLabels`'s wiring passed `stdio: ["ignore", "inherit", "pipe"]`.
With stdout **inherited**, `execFileSync` returns `null`; `JSON.parse(null)` is `null`; the
`.labels` read then throws `TypeError: Cannot read properties of null` on **every** call. So the
read could never succeed — every verified-PR-delivered outcome would have taken FR-003's
read-failure arm and the label would never come off: **FR-001 defeated with typecheck and vitest
both green.**

- **Reproduced before acting** (Node v24.18.0, no GitHub call): the identical body returns `null`
  under `inherit` and the stdout string under `pipe`. The file's eight other stdout-consuming
  `execFileSync` calls all pipe stdout; `setIssueLabel`'s `inherit` is correct *because it never
  reads stdout* — which is exactly why copying its stdio here was wrong.
- **Fixed:** `stdio: ["ignore", "pipe", "pipe"]` — stdout piped (this call consumes it), fd 2
  kept piped so gh's stderr still reaches the throw's message, which is the text FR-003 records
  verbatim. `setIssueLabel`'s own stdio was deliberately **not** touched.
- **Also fixed (adjacent, non-blocking):** Probe 3b's heading claimed "the exact command the
  wiring issues" while the probe adds `--repo cli/cli`; retitled to state it is the wiring's
  subcommand and `--json` field, not its literal argv.
- **Attribution, recorded honestly:** the defect came from the **controller's brief**, which
  copied `setIssueLabel`'s stdio line verbatim. The implementer executed the brief faithfully.
- **Not changed, deliberately:** FR-005 read strictly ("no second literal") holds for the
  label-path argument and console sites; the name also survives inside operator-facing message
  text (`src/loop.ts:2207`, `:2528`, `:2564`) and JSDoc, where FR-004 freezes the wording and T1's
  scope was correct. `readLabels` / `readLabelsThrows` are declared and unused until T3, as the
  plan intends.
  **Superseded by `eaf006e` (marker added at checkpoint-3 acceptance, 2026-09-24):** those three
  operator-facing sites now interpolate `HARNESS_FAILED_LABEL`, so the first half of this
  sentence is no longer true of the shipped tree — which is the point. The JSDoc half still
  holds, and the decision above is left standing as the dated checkpoint-1 decision it was.

**Specification review (rerun at `9970111`): PASS.** The reviewer verified the fix against the
previous candidate's object (`git diff 6ec5c5b 9970111` — the only source change is the `stdio`
flag) rather than trusting the controller's description, and confirmed the T1 sites, the seam's
T3 fit, the absence of any overstated claim, and the deferral honesty.

**Adjacent findings from that review, and their dispositions (no silent scope expansion):**

| # | Finding | Disposition |
|---|---|---|
| 1 | `docs/work/WI-6/evidence/canary-red-driver.ts:106` builds a `QueueLoopDeps` literal now missing `readIssueLabels` | **Pre-existing drift, not a WI-15 regression — follow-up.** Verified by the controller: the literal omits `setIssueLabel` too, which WI-14 made required, and the file has not been touched since WI-6's `aa6f2e0`; `docs/` is outside `tsconfig.json`'s `include`, so typecheck never covered it. It was already uncompilable before this work item. Amending it is out of scope and would mean editing another work item's delivered evidence. **Recommended as its own small work item** if the owner wants that driver runnable again. |
| 2 | Probe 2's block shows a filtered result under "Verbatim result" without its command, below the file's own standard | **Assigned to T4** (docs/evidence task) — T4 must give Probe 2 its command, exit code and verbatim output. |
| 3 | The wiring comment says "reproduced locally" with no recorded evidence in the log | **Assigned to T4** — T4 must record the local `stdio` reproduction (command + verbatim output) as a durable entry, so the rationale is evidence rather than an assertion in a comment. |
| 4 | `readLabelsThrows` has no per-id variant (cf. `setLabelThrowsFor`) | **Recorded non-goal.** T3's assertion is a single-issue queue case; a multi-issue read-failure test would need one, and none is specified. |
| 5 | The seam is wholly dead at this candidate | **Expected by the plan** — the fakes' shape is proven at T3, and the plan says so. |

### Checkpoint 2 — T3 (the removal decides from the read; the classifier deleted)

**Status: ACCEPTED** at candidate `3c0571b4fcd81f79dd31ff8d2e95483db75bcd25` — spec review PASS,
then code-quality review APPROVED, both against that exact identity, both **rerun** after the
amending fix. Commits: T1 `9c19268` → T2 `9970111` → T3 `3c0571b`. Base for the range: `39d1b26`.
The earlier `507bd53` verdicts are superseded and do not carry forward.

- **RED reproduced independently by the controller**, not accepted from the report. Method (no
  stash, no branch mutation): `git checkout 9970111 -- src/loop.ts` to put the pre-T3 product code
  beside the new tests, run the focused suite, then restore with `git checkout 507bd53 --
  src/loop.ts`. Observed: exit 1, **2 failed | 162 passed (164)** — `(f)` and `(g)` both failing on
  `expected "vi.fn()" to not be called at all, but actually been called 1 times`, i.e. the removal
  was attempted unconditionally. The tests fail for the **stated** reason, not a compile error or
  a bad knob. Working tree restored clean at `507bd53` (verified by `git status --short`).
- **GREEN re-run by the controller at `507bd53`:** `npm run typecheck` exit 0; focused exit 0 —
  **164 passed**; `npm test` exit 0 — **285 passed, 10 files**. Exactly the plan's predicted
  arithmetic (162+2, 283+2), which also confirms no existing assertion was rewritten.
- **Product diff inspected:** `clearHarnessFailedLabel` reads → membership-tests → removes, with
  the read's own catch recording `could not read the issue's labels: <reason>`; `setIssueLabel`'s
  `try`/`catch`, `errText` and regex are gone, the call left bare, and its `stdio` still shows fd 2
  piped (`inherit` stdout) as required; `ensureHarnessFailedLabel`'s stale "same classifier shape"
  reference reworded with its own `/already exists/i` check untouched.
- **Review range widened to the whole of Slice 1** (`39d1b26..507bd53`) rather than the T3 delta
  alone: T3 modified code that checkpoint 1's reviews had examined (it deleted the classifier and
  trimmed the 2d comment), so those verdicts are superseded and the full slice is the identity that
  will be delivered. Checkpoint 1's PASS/APPROVED therefore do not carry forward — as its own entry
  already stated they would not.

**Specification review (checkpoint 2): PASS**, no blocking findings. It confirmed the classifier's
deletion, the read-then-decide shape, the prefix and the pre-existing lines for FR-004, the
constant's three production uses, and — importantly — that the two new tests are **non-vacuous**:
`(f)`'s load-bearing assertion is the uncalled removal, and `(g)` proves both the skip and the
recording while deep-equalling every other outcome field against a successful baseline.

**Adjacent findings from that review, and their dispositions:**

| # | Finding | Disposition |
|---|---|---|
| 1 | FR-005's literal wording ("no second literal … in the source") is not met in `src/loop.test.ts`, which keeps `"harness-failed"` in expected-line strings — the plan carves this out deliberately | **T5 must state it explicitly.** The verification record should record that FR-005's scope is the label path in production code, and that test fixtures deliberately keep the literal. |
| 2 | The spec's non-functional section cites "the five recorded probe commands" while the log holds four; the five pre-grilling probes live in `prd.md` prose only | **T4 resolves it by appending the five**, which is what the log's own header promises. |
| 3 | The evidence log records no owner authorization for probes 3/3b against `cli/cli` | **T4 must record the authorization status honestly** — those probes went beyond the plan's named repo and were **not** pre-authorized by it; the controller accepted them and surfaced the deviation to the owner. The log must not imply an authorization that did not exist. |
| 4 | A small TOCTOU window between the read and the remove (a failure inside it is recorded as a removal failure) | **Accepted, no action.** The spec already states the read reflects the state at removal time; the window is inherent and not claimed closed. |
| 5 | `(f)`/`(g)` do not directly assert `readIssueLabels` was called; the read's consultation rests on `(a)` plus `(g)`'s throw propagation | **Accepted, no action** — asserting it would strengthen nothing the FRs require, and changing tests now would invalidate this candidate's reviews. |

**Code-quality review (checkpoint 2): NEEDS_FIXES — two blocking findings, both documentation
staleness, both confirmed at the source by the controller and fixed by amending T3.**

1. `src/loop.ts:226` — `LoopDeps.setIssueLabel`'s JSDoc still asserted "Removal is idempotent by
   contract: an issue not wearing the label resolves successfully" — the exact contract WI-15
   deleted, and a direct contradiction of the wiring comment at `:2745` ("idempotency-free by
   design"). The file argued with itself about the behavior under change.
2. `src/loop.ts:314` — `escalationLabelFailure`'s JSDoc said it is set when a label **write**
   threw; after this candidate a failed **read** sets it too (FR-003, test `(g)`).

Both rewrote to describe the read-before-remove contract and the read-failure arm. **Candidate is
now `3c0571b4fcd81f79dd31ff8d2e95483db75bcd25`**; `git diff 507bd53..3c0571b` verified by the
controller to be **comment-only** (a filtered diff shows no non-comment changed line). Gates re-run
at the new identity: typecheck exit 0, focused **164**, full **285 passed / 10 files**.

**Specification review (checkpoint 2, rerun at `3c0571b`): PASS**, no blocking findings. The
reviewer independently confirmed the delta is comment-only, verified both JSDoc fixes against the
code, swept for surviving stale contract language (`idempotent|classifier|forgiv` returns only the
new negating wording plus unrelated hits), and **reproduced RED itself** in a throwaway `/tmp` copy
rather than relying on the controller's account.

**Spec-rerun adjacent findings, dispositions:**

| # | Finding | Disposition |
|---|---|---|
| 1 | FR-005's success criterion says "no second literal … in the source" while operator-facing line text still spells `harness-failed` (`:2204`, `:2525`, `:2561`); FR-004 forbids changing those wordings | **Same disposition as before — T5 states it.** FR-005's Behavior clause enumerates only create/add/remove/membership, all unified; behavior governs. |
| 2 | FR-002's *title* ("anywhere in the label path") overreaches its removal-scoped Behavior clause, since `ensureHarnessFailedLabel`'s `/already exists/i` deliberately remains | **T5 must record this tension.** The spec should not be read as claiming all error-text matching is gone; the create-time check is scoped out by prd decision 5. |
| 3 | `readIssueLabels` omits `--repo` and relies on cwd = repoDir, an unrecorded dependency | **Already covered** by the reworded Probe 3b heading, which now states the wiring is cwd-scoped and that the probe's `--repo` is the probe's addition, not the wiring's argv. |
| 4 | The spec's "five recorded probe commands" vs the log's four command blocks | **T4 resolves it** by appending the five pre-grilling probes. |
| 5 | `JSON.parse` on raw stdout has no try/catch; malformed output surfaces as a read failure that FR-003 then records | **Accepted, no action** — that is the specified arm, not a gap. |

**A claim of the controller's own, corrected by the reviewer.** The controller wrote that `grep -E`
found "only one unrelated hit" — that grep was scoped to `src/loop.ts`. Over all of `src/` there
are three (`src/attachments.test.ts:181`, `src/sandcastle-adapter.ts:89`, `src/loop.ts:116`), none
a label classifier. The conclusion (the deletion is correct) stands; the count was stated as if it
covered a wider scope than it did. Recorded because the controller holds the implementer to exactly
this standard.

**Actionable asks carried forward:** T5's FR-002 claim ("no error-text matching remains") must
record its **proving command** — `grep -rnE` or a full diff read — rather than an unsourced
assertion; and T4's `## Lessons` line should cover the vacuous-evidence trap (a check that cannot
fail) alongside the classifier-reachability lesson.

**Evidence-quality defect in the implementer's report, recorded.** It claimed
`grep -rn "not found|not present|does not exist|could not remove|couldn't remove" src/` returned
no matches (exit 1). The controller's re-run found three hits, because an alternation without `-E`
is a **literal string search** in basic regex — that command could never have matched anything, so
its empty result was guaranteed rather than informative. The underlying claim is nevertheless
**true**: with `grep -E`, the only surviving hit is `src/loop.ts:116`, an unrelated comment about a
branch ref. The deletion is real; the evidence offered for it was vacuous. This is the same defect
class the work item exists to remove — a check that cannot fail is not evidence — and it is the
reason the controller re-verifies rather than accepting reported commands. No product change is
warranted; it is recorded as a process observation.

**Controller divergence from the implement skill, recorded.** The skill's process reviews after
every dispatch; this checkpoint's reviews were opened as the skill requires. The T1/T2 pair was
grouped as one dispatch (see *Dispatch granularity* above); T3 will follow as its own dispatch
with its own RED, and because it changes the candidate, **both reviews must be rerun for the
Slice 1 candidate** — the T1/T2 verdicts do not carry forward.

## Process events — T4, and a deviation of the controller's own (2026-09-24)

Recorded here rather than only in the conversation, because several of these outlive the session.

**T4 was interrupted mid-flight and resumed.** The leaf implementer stopped when the prior session
ended. Nothing was committed, so checkpoint 3 had no candidate. Inspection of the worktree at
`3c0571b` showed four of the five T4 items already written but uncommitted — the `CLAUDE.md` module
row, both `## Lessons` lines, the plan's `stdio` correction, and the `src/loop.ts` doc fixes — with
the evidence log (item 3) untouched. The same implementer was resumed by message rather than
re-dispatched, so the four finished items were not redone and one identity owns the T4 commit.

**A staging hazard, caught before it landed.** The worktree's `node_modules` is a **symlink**
(`node_modules -> ../../../node_modules`) and is *not* gitignored: the pattern is `node_modules/`
with a trailing slash, which matches a real directory but not a symlink. `git add -A --dry-run` in
the worktree prints `add 'node_modules'`. A blanket staging command would therefore have committed
a `node_modules` symlink into the branch. The implementer was instructed to stage its four changed
paths by name. This is the same class of trap as the `.env`/worktree lesson already under
`## Lessons`, and it is why the commit is inspected here rather than trusted.

**A deviation of the controller's own: the ledger lived in the wrong checkout.** This ledger has
been maintained at the **main** checkout
(`…/software-factory-loop/docs/work/WI-15/implementation-notes.md`, untracked) and not in the
`wi-15` worktree where the implementation happens. The repository's convention says otherwise:
`docs/work/WI-13/implementation-notes.md` and `docs/work/WI-14/implementation-notes.md` are both
**tracked on `main`**, committed on their own branches at each checkpoint
(`d18a323 docs(WI-14): T2 accepted (5470a97) — ledger, blocking-finding record, adjacents`;
`f764e3f docs(WI-14): T4 accepted (e07584e) — ledger + doc-review record`), and `docs/work/WI-15/`
on `main` holds no ledger. The artifact therefore belongs on the branch, and from the main checkout
it could never reach one. The concrete consequence: **the ledger was not committed at checkpoints 1
or 2**, unlike WI-14's precedent. Nothing is lost — the file is intact and complete at the main
path — and the corrective action is recorded for checkpoint 3: copy it into the worktree, prove
byte-identity, commit it on `worktree-wi-15`, then remove the main-checkout copy so exactly one
canonical ledger exists. This is recorded at the same prominence as the implementer's errors: a
controller that re-verifies its leaf's evidence must also report its own process defect.

**`src/loop.ts` is comment-only, proven mechanically rather than accepted on report.** T4's two
edits to that file are comments. The controller's check: `git diff -U0 3c0571b -- src/loop.ts`,
filtered to added lines that are not `//` or `*` comments, and separately to removed lines that are
not, returns **empty for both**. The claim is therefore the controller's own evidence, not the
implementer's word.

**Two stale status headers, observed and deliberately not fixed.** `specification.md` still reads
"Draft — awaiting owner approval" at its status line and "Draft — not approved" at its approval
line, and `implementation-plan.md:3` still reads "Draft — awaiting owner approval. No implementation
has begun." Approval happened by the owner's `/implement` invocation, and this ledger records the
actual state. Rewriting an approved artifact's status header is not FR-006's business, and editing
the record the work traces to would be worse than the stale label. Recorded as an observation for
the delivery record.

**Reversed 2026-09-24 — the stale headers were fixed, and the reversal is recorded here rather
than smoothed.** The specification review at `f988101` caught the contradiction: this
ledger said the headers were deliberately left alone, and a later commit changed them anyway,
with nothing recording the reversal. That is this work item's own defect class — a record making a
claim that is not true of the tree it ships in — so the decision is left standing above and
reversed here, visibly. **Why the first call was wrong:** the objection was that rewriting an
approved artifact's status header is not FR-006's business, but FR-006 *is* docs honesty in the
same delivery, and a delivery whose own plan file says "No implementation has begun." while T1–T4
are complete is exactly the defect class WI-15 exists to remove. The stale text protected nothing;
it was simply false. The framing "editing the record the work traces to" is the wrong one when the
record is factually wrong — the fix is to correct it, and say so. Both are now corrected:
`specification.md`'s status and approval lines, and `implementation-plan.md:3`.

**Owner authorization for the FR-005 criterion amendment — provenance, stated as a limit.** On
2026-09-24 the controller put the reviewer's two remedies to the owner with a recommendation to
amend; **the owner chose to amend**. That exchange is the authorization, and it is recorded here
and in `specification.md`'s `## Amendments`; there is no signed document behind it, and none is
claimed. FR-002's title narrowing and the two header corrections were the **controller's own
calls** under the same reasoning, labeled as such in the Amendments section rather than presented
as owner decisions.

### Checkpoint 3 — T4 (docs honesty and evidence, FR-006)

**Status: accepted at `c66e268` (2026-09-24).** Four specification reviews ran against this
checkpoint and one code-quality review — each verdict recorded by candidate SHA rather than by
ordinal, so it can be checked: **FAIL at `a11d39b`** (two blocking findings and one
missing-evidence item), **PASS at `f988101`** (eight adjacent observations and two missing-evidence
items, dispositioned below), **FAIL at `5bd9a8a`** (one blocking finding — an authority overclaim
in this work item's own `## Amendments`, which is this work item's defect class committed by its
controller), and **PASS at `c66e268`**; the code-quality review returned **APPROVED at `c66e268`**
with no blocking finding. The acceptance is recorded at the end of this entry. Base for the range:
`39d1b26`.

Commits: T1 `9c19268` → T2 `9970111` → T3 `3c0571b` → T4 `ba57d4c`, amended to `a11d39b` →
ledger `8068288` → blocker fix pass `eaf006e` → spec amendment `f988101` → docs-hygiene fix
`5bd9a8a` → attribution fix `c66e268` → checkpoint-3 acceptance (the commit closing this entry).
Stated by SHA rather than as "this commit", which the quality review at `c66e268` correctly
flagged as a self-pointer that two further commits had already invalidated.

**The FAIL, and what it found.** The specification review at `a11d39b` returned **FAIL** on two
blocking findings and one missing-evidence item — while finding **no behavior defect in the label
path** and independently reproducing the controller's gate numbers exactly. Each blocker was
verified at source by the controller before anything was changed:
- **B1 (FR-005)** — three operator-facing message strings still hard-coded the label name
  (`src/loop.ts:2207`, `:2528`, `:2564`), falsifying FR-005's "no second literal of the label name
  remains in the source".
- **B2 (FR-006)** — the `CLAUDE.md` module-row clause claimed "no subprocess error text interpreted
  anywhere in the label path", false while `src/loop.ts:3008` still matches `/already exists/i`
  (deliberately kept, prd decision 5).
- **Missing evidence** — the checkpoint-1 disposition had **assigned the durable local `stdio`
  reproduction to T4**, and the evidence log contained none. The controller's own T4 brief failed to
  carry that assignment forward and the checkpoint-3 inspection did not check for it. A controller
  error, recorded as one.

**The fix pass, `eaf006e`.** The three sites now interpolate `HARNESS_FAILED_LABEL` — rendering-
neutral, with `src/loop.test.ts` untouched and no assertion changed; the `CLAUDE.md` clause is
rescoped to the read and removal path and names the kept create-time check; and the missing
evidence is supplied as the log's **Part 3**, a real local `execFileSync` reproduction. The
controller verified all of it independently rather than on report — including reproducing the
confound Part 3 reports against itself (with the failing child passed via `node -e`, the
`fd 2 ignore` arm *does* report `message contains BOOM-STDERR: true`, because Node's
`Command failed:` line echoes argv, so the original check genuinely could not fail). The reviewer
then reproduced Part 3 byte-for-byte with a matching md5sum across three runs.

**The spec amendment, `f988101`** — FR-005's criterion rescoped to the *uses* of the name (create,
add, remove, membership test, and the operator-facing message text), with comments, JSDoc and test
fixtures named as excluded; FR-002's title narrowed to the removal path; its boundary naming the
kept exception. The owner's authority for the criterion and the controller's authority for the rest
are recorded in the two entries above and in the spec's `## Amendments`.
**Attribution corrected at checkpoint-3 acceptance (2026-09-24).** This sentence previously
credited `f988101` alone with the title narrowing. `f988101` narrowed it to "The label removal
decides from the issue's state, not from subprocess error text"; the **final** wording — "No
subprocess error text is interpreted in the label removal path" — landed in `5bd9a8a`. The
quality review at `c66e268` classified the original as loose attribution rather than a false
claim, and it is corrected here because it is the misattribution class this work item spent two
review rounds on.

**The `f988101` review's findings and their dispositions — recorded here because the ledger's own
stated reason for existing is that these outlive the session.** The review returned PASS and raised
eight adjacent observations plus two missing-evidence items; the dispositions were the controller's,
and they are enumerated rather than left in a session transcript:

| Finding at `f988101` | Disposition |
|---|---|
| Adj 1 — this ledger said the stale headers were deliberately *not* fixed, then a later commit fixed them, with no reversal recorded | **Fixed** — the reversal entry above, with the original decision left standing |
| Adj 2 — `implementation-plan.md:3` said "No implementation has begun." | **Fixed** — now names T1–T4 complete and T5 pending |
| Adj 3 — FR-002's title restated FR-001's state-vs-text axis | **Fixed by narrowing** — the title is the original sentence scoped to the removal path |
| Adj 4 — the `## Amendments` prose said "three operator-facing message sites" where four use the constant | **Fixed** — names the three flagged sites and the fourth (`:3011`) explicitly |
| Adj 5 — `src/loop.test.ts:3792`'s negative assertion uses a hard-coded name, so a rename would make it pass vacuously | **Deferred deliberately** — see ask (g) below |
| Adj 6, 7 — observations that the amended criterion is honest and is not a face-saving weakening | No action — they were observations in the controller's favour |
| Adj 8 — `docs/work/WI-6/evidence/canary-red-driver.ts:106` lacks the now-required deps | **Deferred** — see ask (i) below |
| ME 1 — the owner's authorization existed only in the artifact it authorized | **Addressed** — the provenance note above, with its limit stated |
| ME 2 — the checkpoint-3 FAIL/fix/amend cycle was not recorded in this ledger | **Addressed** — this checkpoint entry |

The `f988101` review also independently reproduced the evidence log's Part 3 (byte-for-byte, with a
matching `md5sum` across three runs) and rebuilt the confound shape to confirm Part 3's
self-correction was genuine rather than a tidy-up.

**What T4 delivered.** Four files: `CLAUDE.md` (the `src/loop.ts` module-row clause + both
`## Lessons` lines), `docs/work/WI-15/evidence/label-state-probes.log` (+130 lines),
`docs/work/WI-15/implementation-plan.md` (the `stdio` correction), and `src/loop.ts` (two
comment-only fixes — the `labelFailures` doc and the wrap above `readIssueLabels`).

**Controller inspection (not the implementer's report).** The commit holds exactly those four
paths and no fifth; `git ls-tree -r --name-only HEAD | grep -c '^node_modules'` is **0**, so the
`node_modules` symlink the warning was sent about did not land; and `git diff -U0 3c0571b --
src/loop.ts` filtered to non-comment added lines, and separately to non-comment removed lines,
returns **empty for both** — comment-only, proven rather than accepted.

**Gates run by the controller at the final identity:** `npm run typecheck` **exit 0**;
`npx vitest run src/loop.test.ts` **exit 0, 164 passed**; `npm test` **exit 0, 285 passed, 10
files**. The implementer's reported counts agree with the controller's own runs; the numbers above
are the controller's.

**T4's four self-reported deviations, each verified rather than accepted.**
1. *The PRD record is not uniformly verbatim* — **verified true** against `prd.md:19–53`: that
   record prints argv for grilling probes 1 and 2 only; probes 3 and 4 show output without argv,
   and probe 5 (`harness-failed` still exists) has no argv, no exit code and no output at all —
   it is one prose bullet. T4's log labels each gap per probe and invents nothing. Accepted; the
   log's Part 2 is an honest transcription, and the incompleteness is the *source record's*, not
   T4's.
2. *`specification.md`'s "five recorded probe commands" is ambiguous now the file holds nine
   blocks* — true. T4 was not allowed to edit the spec and disambiguated inside the log instead
   (the "Which 'five' the specification means" paragraph). Correct call; see the carried ask below.
3. *The worktree `node_modules` symlink is not gitignored* — true, already recorded above.
4. *A transient `error connecting to api.github.com` on the first probe-2 re-run, exit 1, retried
   successfully* — recorded by T4; only the exit-0 stdout is in the log, which is the right
   choice, and the failure is disclosed in the report rather than hidden.

**A defect T4 did not report, found by the controller's inspection.** The log's own header still
asserted **"Every command recorded below is read-only."** That sentence was written for the T2
file, which held only `gh issue list` / `gh issue view` probes; appending Part 2 — whose grilling
probes 2, 3 and 4 are `gh issue edit … --remove-label` calls, three of them, each of which the
file itself says must **not** be re-run — made it false. The file therefore contradicted itself:
header says every command below is read-only, Part 2 says three of them are mutating. This is the
work item's own defect class — a record making a claim that is not true of its contents — so it was
fixed rather than noted: the header now scopes the read-only claim to **Part 1** and states
plainly that Part 2's commands are outward-facing, each run on a non-mutating case, and recorded
rather than re-run. The sentence was pre-existing, so this is not a T4 error of introduction; it
is a T4 self-review miss, and it is the reason the controller reads the artifact instead of the
report.

**The amend.** The header fix was staged by path and folded into the T4 commit
(`git commit --amend --no-edit`), `ba57d4c` → `a11d39b`, because it belongs to the same docs task
— the same treatment T2 and T3's review-driven fixes received. The gate set was then re-run at the
new identity (numbers above), so no GREEN is claimed for a superseded SHA. `ba57d4c`'s verdicts,
had any been taken, would be void; none were.

**Carried into T5.** (a) FR-002's "no error-text matching remains" must record its **proving
command**, not an assertion. (b) FR-005 scoped to the label path in production code, with the test
fixtures keeping the literal deliberately. (c) The FR-002 title-vs-behaviour tension: the
create-time `/already exists/i` check is deliberately out of scope per prd decision 5, so the
title's "anywhere in the label path" needs stating precisely rather than overclaiming. (d) The
spec's "five recorded probe commands" now needs its own sentence, since the evidence file holds
nine blocks in two sets and the phrase means the pre-grilling five. (e) The `build:image` /
`smoke:image` non-claim; the wiring-unexercised-by-vitest non-claim and the no-live-run-bought
non-claim (prd decision 7). (f) The delivery-note items the checkpoint-2 quality review asked for
(a read failure rendering on the removal lines though no removal was attempted; `labelFailures`'
doc — now **fixed** in T4, so this ask narrows to the rendering behaviour alone).
(g) **The deferred test-fixture vacuity** (adjacent 5 of the `f988101` review):
`src/loop.test.ts:3792` asserts `not.toContain("harness-failed label remove failed:")` against a
hard-coded name, so renaming the constant would leave that *negative* assertion passing vacuously.
Deferred deliberately — it sits inside the amended criterion's test-fixture carve-out, and the
sibling assertions at `:3614`, `:3620`, `:3744` and `:3821` pin the rendered text against
hard-coded literals and would fail loudly on a rename. Recorded here because a deferral that lives
only in a session is precisely what this ledger exists to prevent.
(h) **FR-003's last criterion is live-only.** "the label remains on the issue and the next
successful run attempts the removal again" (`specification.md:70-71`) cannot be shown by
dep-injected vitest; it follows by construction from "no removal call is made", and it falls inside
the declared no-live-run boundary. T5 must state that rather than omit it silently.
(i) **Adjacent 8 of the `f988101` review — deferred, and verified well-founded, not merely
asserted.** `docs/work/WI-6/evidence/canary-red-driver.ts:106` is a `QueueLoopDeps` literal with
neither `setIssueLabel` nor `readIssueLabels`; it has been uncompilable since WI-14 made
`setIssueLabel` required, `tsconfig.json`'s `include` (`["src","scripts","vitest.config.ts"]`) never
covered it, and it was last touched by `aa6f2e0` (WI-6). Already recorded at `:117` above; a
follow-up to surface at delivery, not WI-15's to fix.

**Reviews: specification review first, then code-quality review** — both against **the candidate
that closes this entry**, both read-only, sequentially per the quality contract. Every earlier
verdict is void: the `a11d39b` pair by the fix pass, the `f988101` specification PASS by the
docs-hygiene commit, and the `5bd9a8a` verdict by this one. The carried asks (a)–(i) remain T5's,
except (b), (c) and (d), which the amendment resolves by construction rather than by a scoped
claim.

### Checkpoint 3 — accepted at `c66e268`

**Accepted 2026-09-24.** The acceptance criterion is "focused GREEN and both sequential reviews
apply to the exact candidate", and all three hold at `c66e268`: focused GREEN (164 passed), the
specification review **PASS** at `c66e268` with no blocking finding, and the code-quality review
**APPROVED** at `c66e268` with no blocking finding — the same identity, reviewed in the contract's
order, spec first.

**What the quality review verified independently rather than accepting.** It confirmed the source
identity itself (`git log -1 --format='%H %s' -- src/` → `eaf006e`, and that the three later commits
touch only `docs/work/WI-15/*`); reproduced all three gates with the same numbers as the controller
and the specification reviewer; reproduced the **RED** in a throwaway `/tmp` copy — pre-T3
`src/loop.ts` (`git show 9970111:src/loop.ts`) beside the new tests gives `2 failed | 162 passed
(164)`, both at `expect(deps.setIssueLabel).not.toHaveBeenCalled()` — so the RED fails for the
stated reason and not from a compile error; checked FR-005 by `grep` rather than by claim (one
non-comment hit, the definition at `:64`); checked the secrets posture at the emission seam rather
than assuming it; and confirmed the classifier is gone from the removal path while the kept
create-time `/already exists/i` is named as the exception in the code, the spec and the `CLAUDE.md`
row. Its verdict on hard constraints: none violated — no merge/review/canary/revert/push code
touched (1), dep-injected tests with the RED reproduced by the reviewer (2), and no acquisition,
planning or spend path touched (5); `harness-prd-v2.md` untouched and `docs/work/WI-14/*` absent
from the range. Nothing in its report contradicts a controller check; every number it gives
matches one already in this ledger.

**Its one Important finding — disposed, no action required.** The two `cli/cli` probes in the
evidence log (`label-state-probes.log:88-150`) exceeded the plan's single authorized probe and are
recorded in the log as **not pre-authorized**. The review confirms **hard constraint 3 is not
engaged** — both were read-only `gh issue` reads against a public, non-client repository, and no
client repo, issue list or log is wired in anywhere in the change — and states no action is
required, recording it only so the outward-facing action stays visible to the owner. It already is:
in the log, in this ledger, and in the delivery record.

**The three narration items — closed here, not fixed earlier.** The review agreed they should not
have blocked delivery and gave the one-line improvement each would take "if the file is ever
touched again". The file is being touched again, so all three are closed in this same commit: the
checkpoint-1 bullet now carries a **Superseded by `eaf006e`** marker (its claim that the label name
still survives at `:2207`, `:2528`, `:2564` was false of the shipped tree); the checkpoint-3 commit
chain is stated by SHA throughout with `8068288` and `5bd9a8a` added, replacing a "(this commit)"
that two later commits had invalidated; and the title-narrowing attribution now names `f988101` for
the first narrowing and `5bd9a8a` for the final wording. Two of the three are the misattribution
class this work item spent two rounds on; the third is its defect class in miniature — a record
asserting something untrue about its own contents.

**Deferred, as follow-ups rather than scope expansion.** (j) `src/loop.test.ts:3813` and `:3817`
assert the same `escalationLabelFailure` value twice in test `(g)`; the destructured repeat is
redundant, and the one-line fix is to delete it. **Not fixed now, deliberately:** it is a `src/`
edit, so it would change the source identity, void both `c66e268` verdicts *and* the Part 3
evidence, and cost two review cycles — disproportionate to a duplicate assertion the review itself
classified cosmetic. (k) FR-006's text asks for the grilling lesson "as one line under
`## Lessons`" and two landed (`CLAUDE.md:159-160`); both are true and both concern this work item's
defect classes, so it is an extra honest lesson rather than scope creep — recorded only because the
count does not match the spec's singular phrasing. Minor finding 5 is ask (g), already deferred
above.

**What this commit is, and what the verdicts therefore describe.** This acceptance commit is
**docs-only** — no `src/` path, so the source identity stays `eaf006e` and the shipped code the two
verdicts examined is byte-identical to what they saw. By this ledger's own standard a later commit
voids an earlier verdict, and that standard is not being waived here: the two verdicts are recorded
as describing **`c66e268` and nothing later**, and the prose that lands after them — these three
closures and this acceptance record — is covered by the lifecycle's stage-4 `code-review`, which
reviews the whole range at final HEAD. Stating that plainly is the point; a ledger that claimed the
`c66e268` verdicts certified a commit made after them would be this work item's defect class again.

### Stage 4 — the review, as it actually went

Appended rather than rewritten, so the paragraph above stands as what was true at `0035506`.

The stage-4 `code-review` ran **twice**, four axes each time, and the record is `review.md`:

| Round | Candidate | Outcome |
|---|---|---|
| 1 | `5946199` | standards PASS, specification PASS, complexity PASS, **evidence/risk FAIL** — one blocking finding: the FR-005 sweep printed a command that did not produce its table (29 lines vs 14 rows), which is this work item's own vacuous-evidence class committed inside the record certifying the work |
| 2 | `d54d8ae` | **four PASS**, the evidence axis confirming the remedy by running the command itself and reproducing the RED in a throwaway copy |

Round 2 raised six adjacent findings, all in `verification.md`, all corrected in `e12d8f4`
(docs-only); the evidence axis re-checked those six rows and returned PASS, running the replacement
commands rather than reading the figures. Three of the round-1 and round-2 findings were reached
independently by two axes each.

The forward reference two paragraphs up is therefore **fulfilled, not pending** — and the same
ordering caveat applies one level down: the corrections in `e12d8f4` and the record `review.md` both
postdate the four `d54d8ae` verdicts, which `review.md` states in its own closing section rather than
letting a reader discover it. No `src/` path moved at any point after `eaf006e`.

---

### Correction — 2026-09-24 (follow-up branch `wi-15-followup`): the WI-6 driver's rot is older and wider than this ledger recorded

A follow-up pass **re-measured** `docs/work/WI-6/evidence/canary-red-driver.ts` rather than reading
the claim above, and the claim was wrong on both of its particulars. What checkpoint 1 (`:121`),
checkpoint 3 (`:370`, `:451`) and `verification.md`'s remaining risk 4 all said was:

> a `QueueLoopDeps` literal carrying neither `setIssueLabel` nor `readIssueLabels`, uncompilable
> since WI-14

| Recorded | Measured |
|---|---|
| Two deps missing | **Six** missing |
| Broken since WI-14 | Broken since **WI-13** (`cca5e53`) |

**The six, by the work item that made each required:** `branchConflictsWithMain`, `runMerger`,
`pushBranch` (WI-13); `commentOnIssue`, `setIssueLabel` (WI-14); `readIssueLabels` (WI-15). The file
also still carries two properties WI-13 deleted: `runTriage` and `triage`.

The missing set, re-derived by direction comparison — 19 `LoopDeps` members minus the literal's 20
(the extra ones being `QueueDeps` members):

```
$ sed -n '/^export interface LoopDeps {/,/^}/p' src/loop.ts | grep -oE '^  (readonly )?[a-zA-Z_]+' | sed 's/readonly //' | sort -u > /tmp/a
$ sed -n '/^const deps: QueueLoopDeps = {/,/^};/p' docs/work/WI-6/evidence/canary-red-driver.ts | grep -oE '^  (async )?[a-zA-Z_]+' | sed 's/async //' | sort -u > /tmp/b
$ comm -23 /tmp/a /tmp/b
  branchConflictsWithMain
  commentOnIssue
  pushBranch
  readIssueLabels
  runMerger
  setIssueLabel
```

The date, from the deletion that broke it:

```
$ git log --oneline -S'runTriage' -- src/loop.ts | head -1
cca5e53 feat(WI-13): planner pass wired, --triage retired with loud startup error (FR-001, FR-009)
```

Compiling the file shows only those two deleted properties:

```
$ npx tsc --noEmit --ignoreConfig --skipLibCheck --strict --target ES2022 \
    --module NodeNext --moduleResolution NodeNext --types node \
    docs/work/WI-6/evidence/canary-red-driver.ts
docs/work/WI-6/evidence/canary-red-driver.ts(209,3): error TS2353: Object literal may only specify known properties, and 'runTriage' does not exist in type 'QueueLoopDeps'.
docs/work/WI-6/evidence/canary-red-driver.ts(220,85): error TS2353: Object literal may only specify known properties, and 'triage' does not exist in type 'QueueRunInput'.
```

(Line numbers are on the delivered file. On the file as first measured, before the banner shifted
it, the same two errors read `(201,3)` and `(212,85)` — which is why the records corrected alongside
this note point at `:114`.)

**Why the earlier reading saw only two.** TypeScript prints the *excess*-property error for an object
literal and **suppresses** the missing-property error behind it, so the two deleted properties mask
all six missing deps. Isolated — a literal with one excess property and every required property
absent — the missing list does not appear at all:

```
$ npx tsc … zz-probe.ts      # const x: QueueLoopDeps = { zzz: 1 };
zz-probe.ts(2,28): error TS2353: Object literal may only specify known properties, and 'zzz' does not exist in type 'QueueLoopDeps'.
```

The check *does* fire on this type once nothing masks it — the control for the paragraph above, so it
is not read as "the check never runs":

```
$ npx tsc … zz-probe.ts      # const x: QueueLoopDeps = {};
zz-probe.ts(2,7): error TS2322: Type '{}' is not assignable to type 'QueueLoopDeps'.
  Type '{}' is missing the following properties from type 'LoopDeps': env, runFixRun, createFixSandbox, deleteBranch, and 15 more.
```

Both probes were written into `docs/work/WI-6/evidence/` so their relative imports resolve exactly as
the driver's do, and deleted immediately; `git status` after them showed nothing but the owner's
pre-existing modification to `docs/work/reports/harness-functionality-guide.html`.

**Disposition — owner decision (b), 2026-09-24: labelled, not repaired.** The driver's header now
opens with a `HISTORICAL ARTIFACT — NOT RUNNABLE` banner, and the three records that carried the wrong
diagnosis are corrected in place, each noting what it said before. Repair was declined deliberately:
compiling would mean writing six stubs for deps that did not exist when WI-6 ran, and the result would
compile without being verified — the fixture state that run depended on is gone, so its logs cannot be
reproduced from the driver either way. A file that looks runnable and is not is worse than one that
says what it is. Option (c) — repair it *and* re-run it live in Docker against a re-seeded fixtures
repo — stays open if the owner ever wants that driver back.

### Follow-up — 2026-09-24 (same branch): the skill drift is wider than the pending list recorded

Pending row 9 named two skills that drift between the personal `~/.claude/skills/` copies and this
repository's committed `.claude/skills/`. Re-measured rather than read off the row, **all 16 shared
skills differ** — the row named a sample and stated it as the extent:

```
$ comm -12 <(ls -1 ~/.claude/skills | sort) <(ls -1 .claude/skills | sort) | wc -l
16
$ for s in $(comm -12 …); do diff -rq ~/.claude/skills/$s .claude/skills/$s >/dev/null || echo "DIFFERS: $s"; done
DIFFERS: code-review          DIFFERS: diagnosing-bugs       DIFFERS: domain-modeling
DIFFERS: finishing-a-development-branch          DIFFERS: grilling        DIFFERS: handoff
DIFFERS: implement            DIFFERS: ponytail              DIFFERS: setup-agentic-workflow
DIFFERS: tdd                  DIFFERS: to-prd                DIFFERS: to-spec
DIFFERS: to-tickets           DIFFERS: using-git-worktrees   DIFFERS: verification-before-completion
DIFFERS: writing-plans
```

**Neither lineage is simply older**, which is why "16 differ" is not by itself a defect. The project
copies carry repo-specific text the personal ones lack — the GitHub Issues tracker line, the
spec-resolution order, `harness-prd-v2.md`, the `## Project context` section in
`finishing-a-development-branch` (`:17`). The personal copies carry material the project ones lack —
`smells.md`, `agents/` subagent definitions, and the fourth review axis. Two lineages that both
moved. Tracked copies were last touched by `9830b7a` / `5c04780`, before any work item ran.

**Why this mattered enough to act on.** WI-15's stage-4 review ran **four** axes. The repository's
committed `code-review` defined **two**, and its frontmatter promised four — a hybrid whose
description contradicted its own body. So `review.md` documented a process a teammate reading
`.claude/skills/` could not reproduce; they would have run a narrower review and had no way to know
the record described a wider one.

**Action taken — owner decision, 2026-09-24: bring the committed copy up to what was actually run.**
`code-review/SKILL.md`'s body is now four-axis, keeping every repo-specific adaptation it already
carried and the house section format. Two files added alongside it: `smells.md` (the reference the
four-axis skill points at, which the two-axis body had inlined instead) and `agents/openai.yaml`
(matching the six sibling skills that ship one). The other **15 shared skills were left alone** —
repo-adapted text versus personal extra tooling is a legitimate difference, not rot, and the owner
scoped this to the one skill whose divergence made a record unreproducible.

Verified after the edit — all four axes named, house headings intact, no reference dangling:

```
$ for a in "repository standards" "specification fidelity" "evidence and risk integrity" "unnecessary complexity"; do
    echo "$(grep -ic "$a" .claude/skills/code-review/SKILL.md)  $a"; done
3  repository standards      1  specification fidelity
1  evidence and risk integrity      2  unnecessary complexity
$ grep -n '^## ' .claude/skills/code-review/SKILL.md      # Required inputs … Next recommended skill, 8 sections
```

**One dangling optional reference, kept deliberately.** `.claude/skills/code-review/SKILL.md` lists
`docs/agents/project-policy.md` under *Optional inputs*; this repository does not have that file
(only `issue-tracker.md` and `workflow.md`). It is kept because the four-axis skill that ran names
it, `ponytail` names it too, and it is a template `setup-agentic-workflow` ships
(`templates/project-policy.md`) that this repo simply never instantiated. Flagged rather than
silently dropped, and rather than invented into existence.

**Non-claim.** No test or typecheck covers `.claude/skills/` — it is outside `src/` and outside
`tsconfig.json`'s include, and there is no lint step in this repository in which to hang a check. The
evidence above is inspection and path resolution, which is the strongest evidence this surface admits;
a green `npm test` would say nothing about it and is not offered as though it did.

### Follow-up — 2026-09-24 (same branch): the two deferred test assertions, closed with a mutation probe

Pending row 5 deferred two assertions in the (g) test — a duplicate and a subsumed one — on the
reasoning that "a `src/` edit void[s] both current verdicts." That reasoning expired when the branch
merged: the round-2 verdicts describe `d54d8ae`, a tree that is now delivered, so a further edit
voids nothing that was not already historical. Closed on the owner's decision.

The change is two deletions, `src/loop.test.ts` only:

```
$ git diff -- src/loop.test.ts
-    expect(outcome.escalationLabelFailure).toBe(REASON);
-    expect(outcome.merged).toEqual(baseline.merged);
$ git diff --quiet -- src/loop.ts && echo "src/loop.ts IDENTICAL to HEAD"
src/loop.ts IDENTICAL to HEAD
```

**The claim to defend is "coverage preserved", not "fewer lines".** Deleting an assertion is exactly
the move that can silently remove a guard, so it was probed rather than argued. Three probes, each
run against the working tree and reverted immediately.

**Probe 0 — was the deleted `merged` assertion vacuous?** If `baseline.merged` were `undefined`, the
line would have compared `undefined` to `undefined` and deleting it would prove nothing either way. It
is not:

```
$ # temporary `throw` in the (g) test, reverted immediately
PROBE baseline.merged={"prUrl":"https://github.com/manjula25/loop-fixtures-py/pull/9","mergeCommit":"m0ckmerge","canaryGreen":true} outcome.merged={…same…} equal=true
```

**Probe 1 — the surviving duplicate still guards the field.** `src/loop.ts:831` mutated to record
nothing on a failed read (`return {};`). The deleted line was a byte-identical duplicate of the
survivor at the destructure, so the survivor must fail:

```
× (g) a throwing label read: the removal is skipped and the read is recorded on the existing line
AssertionError: expected undefined to be 'could not read the issue\'s labels: g…'
Tests  1 failed | 163 passed (164)
```

**Probe 2 — the surviving whole-outcome comparison subsumes the deleted `merged` assertion.**
`src/loop.ts:831` mutated to also return `merged: undefined`, which the spread at the canary-green
return places *after* `merged`, so only the read-failing run diverges:

```
× (g) a throwing label read: the removal is skipped and the read is recorded on the existing line
AssertionError: expected { branch: 'fix/gh-1', …(2) } to deeply equal { branch: 'fix/gh-1', …(2) }
Tests  1 failed | 163 passed (164)
```

Exactly one test failed, on the `expect(rest).toEqual(baseline)` line — so `rest` does carry `merged`
and the comparison is a real guard on it, not a tautology.

An earlier, blunter attempt is recorded because it was the wrong probe and looked like a result:
forcing `merged: undefined` at the canary-green return itself failed **20+** tests, which shows the
field is load-bearing across the file but says nothing about whether `rest` covers it. A probe that
breaks everything cannot answer a question about one comparison.

**Restoration and verification.** `cp /tmp/loop.ts.orig src/loop.ts`; `git diff --quiet -- src/loop.ts`
→ identical to HEAD, and `git diff --check` is clean (an intermediate edit left four trailing spaces
on a blank line, since removed). Then:

```
$ npm run typecheck        # exit 0, no diagnostics
$ npx vitest run src/loop.test.ts   → 164 passed (1 file)
$ npm test                 → 285 passed (10 files)
```

**Non-claim.** This follow-up branch now carries a `src/` change, and the four-axis verdicts in
`review.md` describe `d54d8ae`. They do not cover it. A review of the new one-commit range is the
owner's call and **has not been run** — the verification above is the full extent of the evidence
behind this edit.

### Follow-up — 2026-09-24 (same branch): the WI-6 pointers, and a third unrunnable file

Checkpoint 1 (`:121`) ruled amending WI-6's record out of scope: *"Amending it is out of scope and
would mean editing another work item's delivered evidence."* The owner has now authorized it, and
that entry is left standing as the historical position, as the checkpoint ledger's rule requires.
This note records the reversal.

**Scope re-measured rather than read off the earlier note** — the same discipline that produced the
six-deps finding, applied one directory wider. The WI-6 evidence directory holds four `.ts` files;
**three** do not compile:

```
$ for f in docs/work/WI-6/evidence/*.ts; do npx tsc --noEmit --ignoreConfig --skipLibCheck --strict \
    --target ES2022 --module NodeNext --moduleResolution NodeNext --types node "$f"; done
canary-red-driver.ts     exit=1 errors=2
requeue-proof.ts         exit=1 errors=2
review-exercise.ts       exit=0 errors=0
t7b-requeue-proof.ts     exit=1 errors=2
```

Two of those were not known when item 6 was closed. Both are a **smaller and differently-dated break
than the driver's** — one dep, not six:

```
$ npx tsc … docs/work/WI-6/evidence/requeue-proof.ts
requeue-proof.ts(93,37): error TS2741: Property 'refreshRemoteRefs' is missing in type '{ … }' but required in type 'QueueDeps'.
requeue-proof.ts(108,32): error TS2345: Argument of type '{ … }' is not assignable to parameter of type 'QueueDeps & Pick<LoopDeps, "deleteBranch">'.
$ git log --oneline -S'refreshRemoteRefs' -- src/queue.ts | tail -1
7d84b10 feat(WI-7): acquisition-time remote refresh — fetch/prune before dedup (FR-001)
```

Adding that one dep and nothing else clears both errors — probed, not assumed. `t7b-requeue-proof.ts`
is the same shape: same single missing dep, errors at `(88,37)` and `(103,32)`. So both broke at
**WI-7**, not WI-13, not WI-14, and by one dep rather than six.

All four line numbers above are on the delivered files, after the banners landed. Before the banners
the same errors read `(84,37)`/`(99,32)` and `(82,37)`/`(97,32)` — and the first figures written into
this note were those pre-banner ones, carried over from the measuring run by exactly the mistake the
item-6 note already records: adding a header shifts every line beneath it. They were re-measured
rather than adjusted by arithmetic, which is the second time in this work item that counting the
lines a banner adds gave the wrong answer.

A first attempt at that probe is recorded because it was misleading: run from `/tmp`, it produced
four `TS1309: cannot use 'await' at the top level` errors that were artifacts of the probe's own
directory — `/tmp` has no `package.json`, so the copy was treated as CommonJS. A probe has to run
under the same module settings as the file it probes, or it measures itself:

```
$ npx tsc … docs/work/WI-6/evidence/zz-probe-requeue.ts   # in place, refreshRemoteRefs added
(clean)
$ rm docs/work/WI-6/evidence/zz-probe-requeue.ts          # deleted immediately; git status clean
```

**What changed — annotations that keep the history rather than delete it.** These runs genuinely
happened and their logs are real evidence; the reader's actual failure mode is *re-running* a command
that no longer works. So nothing was removed:

- `requeue-proof.ts` and `t7b-requeue-proof.ts` now open with the same `HISTORICAL ARTIFACT — NOT
  RUNNABLE` header the driver carries, and their embedded run commands are marked HISTORICAL.
- `verification.md`'s three command sites — `:277` (the driver), `:311` (requeue-proof), `:472`
  (t7b) — each carry a **Historical — do not re-run** note naming what broke and when. The command
  lines themselves stay, because deleting them would erase that the run happened.

Left alone deliberately: `delivery.md:46` and `implementation-notes.md:327`/`:350` describe what the
drivers did as *history* without instructing anyone to run them, so they are accurate as written.

## Correction — appended 2026-09-24 (this ledger is not rewritten)

The follow-up review's specification-fidelity axis found **two claims above that are false**, not
merely stale, and one scope change the record never named. They stay standing where they were
written, because this file's job is to record what was believed at each checkpoint; the corrections
follow here, per the rule this same branch writes into `CLAUDE.md` (standing claims corrected in
place, the chronological ledger appended to).

**1. The claim about the committed `code-review` frontmatter is wrong on both halves.** Lines
661-665 say the committed skill "defined **two**, and its frontmatter promised four — a hybrid whose
description contradicted its own body." Measured at the merge commit:

```
$ git show 0b46971:.claude/skills/code-review/SKILL.md | sed -n '3p'
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes — Standards …
$ git show 0b46971:.claude/skills/code-review/SKILL.md | grep -c four
0
```

The frontmatter said **two axes**; it never promised four, and there was no hybrid — description and
body agreed. What actually drifted was **the record against the skill**: `review.md` documents four
axes having run while the committed skill defined two. That is still the real defect, and still why
row 9 was worth acting on. The sentence simply misdescribes the artifact — and its error shape is
the one this work item keeps meeting: attributing to one file what was measured about a different
pairing.

**2. "six sibling skills" is wrong; seven shipped one at the merge.**

```
$ git ls-tree -r --name-only 0b46971 .claude/skills | grep -c 'agents/openai.yaml'
7
```

Line 671 says "matching the six sibling skills that ship one". Seven did at `0b46971` —
`finishing-a-development-branch`, `setup-agentic-workflow`, `to-spec`, `to-tickets`,
`using-git-worktrees`, `verification-before-completion`, `writing-plans` — and with `code-review`
added, eight do now.

**3. An unrecorded scope change: the smell baseline was swapped, not shrunk.** Line 669 calls
`smells.md` "the reference the four-axis skill points at, which the two-axis body had inlined
instead". It is more than a relocation. The inlined baseline named twelve Fowler smells, each with a
*what it is → how to fix* clause; the personal `smells.md` carries twelve different, shorter prompts.
Net effect — `Mysterious Name` and `Refused Bequest` are no longer named, while `Long parameter
list`, `Parallel inheritance hierarchies` and `Comments compensating for unclear structure` are.
Twelve for twelve, so the complexity axis read it as "a strict shrink" and the specification axis
read it as two smells lost; both are describing the same swap from opposite ends and neither
description is complete. Row 9's authority covered **the axes**, not the smell set, so this is a
scope change that no requirement asked for. Recorded, not corrected: the resolution is the owner's
call, and it changes what every future review in this repository is prompted by.

**Also corrected in this pass, in place rather than here.** The same review's standards axis found
the range writing down the standing-claim rule and then not applying it to three artifacts the rule
names by title — `delivery.md`, `review.md`, `verification.md` each carried claims this branch had
falsified (source identity `eaf006e`, "every later commit is docs-only", `never pushed`, "no merge
was performed"). Those are standing claims, so they were corrected where they stood, each carrying
the command that proves the new figure. This ledger is the one artifact of the four that was left
standing — deliberately.
## Correction — appended 2026-09-24 (second pass; this ledger is not rewritten)

The first follow-up pass corrected four claims. Re-measuring the corrected artifacts found three more
errors, plus two defects that the first pass introduced. All are recorded here; the standing claims
they touch (`delivery.md`, `review.md`, `verification.md`) were corrected in place.

**4. The PR's range ended at the wrong commit.** The records pinned PR #20 at `0d371ef..aa1d2ca` —
"16 commits, 12 paths, +2527/-44". `aa1d2ca` is not the PR's head. The delivery-actions commit
`cd6e547` was pushed on top of it, so the merged PR is **17 commits, 12 paths, +2581/-44**:

```
$ git ls-remote origin 'refs/pull/20/head'
cd6e5474576c5b6436c292bf57f47f92cf52d2e9	refs/pull/20/head
$ git diff --shortstat 0d371ef..aa1d2ca
 12 files changed, 2527 insertions(+), 44 deletions(-)
$ git diff --shortstat 0d371ef..cd6e547
 12 files changed, 2581 insertions(+), 44 deletions(-)
$ git rev-list --count 0d371ef..cd6e547
17
```

2527 + 54 = 2581, and the 54 lines are `cd6e547`'s own additions to `delivery.md`. This is why the
record appeared to disagree with the GitHub API, which reported `additions: 2581` for PR #20 — checked
with `gh pr view 20 --json additions,deletions,changedFiles`. The instinct to reconcile the two as an
unexplained discrepancy was wrong: GitHub was right and the record had named a commit that is not the
PR. The quoted `gh pr view` read-back in §Executed stays verbatim, because it is a faithful snapshot
of the PR *as created* — at `aa1d2ca`, 16 commits — and it is labelled as such now.

**5. The missing-dep count is eight, not six — and not seven either.** `704f443` corrected the driver's
diagnosis to "six missing deps". Six is what TypeScript prints: an intersection-type failure is
reported through **one constituent only**, and the list is truncated ("…and 2 more"), so the compiler
never sees `QueueDeps`' `refreshRemoteRefs` or the inline `runPlan`. Enumerating every constituent's
required members and diffing them against the literal's keys gives eight:

```
$ sed -n '/^export interface LoopDeps/,/^}/p' src/loop.ts \
    | grep -oP '^\s{2}(?:readonly\s+|async\s+)?\K[a-zA-Z_]+(?=\s*[(:<])' | sort -u   # 19
$ sed -n '/^export interface QueueDeps/,/^}/p' src/queue.ts \
    | grep -oP '^\s{2}(?:readonly\s+|async\s+)?\K[a-zA-Z_]+(?=\s*[(:<])' | sort -u   # 7
$ sed -n '114,212p' docs/work/WI-6/evidence/canary-red-driver.ts \
    | grep -oP '^\s{2}(?:async\s+)?\K[a-zA-Z_]+(?=\s*[(:,])' | sort -u              # 20 present
$ comm -23 <(cat loopdeps.txt queuedeps.txt <(printf 'runPlan\n') | sort -u) present.txt
branchConflictsWithMain
commentOnIssue
pushBranch
readIssueLabels
refreshRemoteRefs
runMerger
runPlan
setIssueLabel
```

*The first attempt at this command was wrong and is recorded because it nearly became evidence.* It
matched member declarations with `^\s{2}[a-zA-Z_]+`, which captures `async` and `readonly` as names
and the real member as a following token — so `deleteBranch`, plainly present in the literal as
`async deleteBranch(repoDir, branchToDelete)`, was reported **absent**. The corrected pattern uses
`(?:readonly\s+|async\s+)?\K` to skip modifiers. A command whose output contradicts what is visibly
in the file is not evidence of anything.

**6. Two line-number citations in `verification.md` were stale.** `:3935` and `:3821` referred to the
pre-deletion tree. `72faee7` removed two assertions at `:3814`/`:3817`, moving everything below the
cut up by two:

```
$ sed -n '3819p;3933p' src/loop.test.ts
    expect(report.stderr).toContain(`harness-failed label remove failed: ${REASON}`);
    expect(text).toContain("LABEL REMOVE FAILED gh-1: gh: label remove failed — network");
```

Corrected to `:3933` and `:3819`. This is the same drift already corrected in `delivery.md` risk 3 —
the first pass fixed one artifact and did not check whether the same citation appeared in the other.

**7. Two defects introduced by the first correction pass itself.**

- **A printed command whose output no command produces.** The §Branch and base correction printed
  `git branch -r --contains 39d1b26` → `origin/worktree-wi-15`. That line was copied from an earlier
  section of the record instead of re-run. The real output is `origin/HEAD -> origin/main` and
  `origin/main`: the branch was deleted from the remote when PR #20 merged. This is the exact defect
  class the work item exists to remove, committed inside the correction written to remove it.
- **A table split in two.** The same correction inserted its prose into the middle of §Branch and
  base's six-row table, orphaning the `Status` row below the notes. `git show HEAD:docs/work/WI-15/delivery.md`
  shows the committed section was a six-row table and nothing else, so the breakage was introduced
  here, not inherited.

Both are now fixed, and both are the reason the second pass re-ran every command it had printed
rather than reading the figures off the first pass's text.
