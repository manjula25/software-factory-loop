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

**Status: not yet accepted.** Three specification reviews have run against this checkpoint — each
verdict recorded by candidate SHA rather than by ordinal, so it can be checked: **FAIL at
`a11d39b`** (two blocking findings and one missing-evidence item), **PASS at `f988101`** (eight
adjacent observations and two missing-evidence items, dispositioned below), and **FAIL at
`5bd9a8a`** (one blocking finding — an authority overclaim in this work item's own `## Amendments`,
which is this work item's defect class committed by its controller). All are addressed; the
verdict for the candidate closing this entry is pending. Base for the range: `39d1b26`.

Commits: T1 `9c19268` → T2 `9970111` → T3 `3c0571b` → T4 `ba57d4c`, amended to `a11d39b` →
blocker fix pass `eaf006e` → spec amendment `f988101` → docs-hygiene fix (this commit).

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