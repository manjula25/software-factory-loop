# WI-15 — Code Review

Four axes, each a read-only reviewer with no access to the others' context, run three times: at
`5946199`, again at `d54d8ae` after the first round's corrections, and a third pass over the
follow-up branch's range `d54d8ae..0a54a66` (see *Round 3* at the end). Verdicts are kept separate
and never merged — a change can follow every standard and still implement the wrong thing, and
reporting one axis' result as another's is how that goes unnoticed.

## Candidate identity

| | |
|---|---|
| **Fixed point** | `39d1b26` (`main`; the merge-base, and the T0 planning-chain commit) |
| **Round-1 candidate** | `5946199` — `39d1b26..5946199`, 11 commits, **8** changed paths |
| **Round-2 candidate** | `d54d8ae` — `39d1b26..d54d8ae`, 12 commits, the same **8** paths |
| **Source identity** | `eaf006e` — the last commit touching `src/` **within the reviewed range** |
| **Post-review correction** | `e12d8f4` — docs-only; see *After the verdicts* below |
| **Branch / worktree** | `worktree-wi-15`, `.claude/worktrees/wi-15` |

The round-2 candidate adds one docs-only commit to the round-1 range: no path changes, because that
commit edited files already in the range. Verified, not asserted:

```
$ git log -1 --format='%H %s' -- src/
eaf006e624b9b7d3a5dc6b8917ab1254a00923a7 fix(wi-15): spec-review findings — …
$ git diff --name-only eaf006e..d54d8ae
docs/work/WI-15/implementation-notes.md
docs/work/WI-15/implementation-plan.md
docs/work/WI-15/specification.md
docs/work/WI-15/verification.md
```

So every commit after `eaf006e` — **within the reviewed range** — is docs-only, and both rounds
reviewed the same `src/` tree.

*Corrected 2026-09-24.* Both statements above previously stood unqualified — "the last commit
touching `src/`", "every commit after `eaf006e` is docs-only". The follow-up branch
`wi-15-followup` then changed `src/` itself: `72faee7` deletes two assertions from
`src/loop.test.ts` (the delivery record's risk 5). Unscoped, both sentences are false of the branch
as it now stands, and the command printed above proves their opposite when run at the current tip:

```
$ git log -1 --format='%H %s' -- src/      # at the round-2 candidate d54d8ae
eaf006e … fix(wi-15): spec-review findings …
$ git log -1 --format='%H %s' -- src/      # at the follow-up tip
72faee7 test(wi-15): drop the duplicate and subsumed assertions the review flagged
```

The verdicts below still describe the `src/` tree they name — `eaf006e`'s — and the two deleted
assertions are an assertion deletion, not a behavior change. What changed is the branch the sentence
described, not what the rounds reviewed.

## Changed-path accounting

All 8 paths, with what each carries:

| Path | Churn | Carries |
|---|---|---|
| `src/loop.ts` | 139 changed lines | FR-001..FR-005 — the read-before-remove decision, the deleted classifier, the shared constant, the operator-message sites re-pointed at it |
| `src/loop.test.ts` | +90 / −0 | tests **(e)** extended, **(f)**, **(g)**, plus the `readIssueLabels` seam in both dep builders |
| `CLAUDE.md` | 4 lines | FR-006 — the `src/loop.ts` module row and the `## Lessons` lines |
| `docs/work/WI-15/implementation-plan.md` | 13 lines | the stale `**Status:**` header, corrected (controller call) |
| `docs/work/WI-15/specification.md` | 68 lines | the `## Amendments` section and the amended FR-002/FR-005 clauses |
| `docs/work/WI-15/implementation-notes.md` | +525 | the controller's checkpoint ledger |
| `docs/work/WI-15/verification.md` | +282 | the verification record (T5) |
| `docs/work/WI-15/evidence/label-state-probes.log` | +412 | the recorded `gh` probes — the entire evidence base for the two untested subprocess calls |

## Round 1 — verdicts at `5946199`

| Axis | Verdict |
|---|---|
| Repository standards | **PASS** |
| Specification fidelity | **PASS** |
| Unnecessary complexity | **PASS** |
| Evidence and risk integrity | **FAIL** — one blocking finding |

### Round 1 blocking finding — remedied in `d54d8ae`

`docs/work/WI-15/verification.md`'s FR-005 "sweep" printed the command
`grep -rn "harness-failed" src/` above a 14-row table whose rows were in fact the output of
`grep … | grep -vE ':\s*(\*|//)'` — the filter the same paragraph declared inadmissible. The command
yields **29** lines; the table held **14**. This is the vacuous-evidence class this work item exists
to remove, committed inside the record that certifies the work.

Remedied in `d54d8ae` by rebuilding the sweep as a 29-occurrence enumeration with each line classified,
recording the false claim rather than quietly replacing it. The conclusion did not move — the
reviewer had independently re-derived it — but the evidence for it was not what it claimed to be.

### Round 1 adjacent findings

- **Standards (4, all judgement calls, no documented-standard breach):** the duplicated
  `readIssueLabels` test seam at `src/loop.test.ts:288-295` / `:1867-1874`; `setIssueLabel(…,
  "remove")` safe only because its caller reads first; the required-dep ripple onto
  `docs/work/WI-6/evidence/canary-red-driver.ts`; a read failure rendering on a line that says
  *remove failed*.
- **Specification (1):** the `## Amendments` heading named three of the five edits it governs.
- **Complexity (2):** `src/loop.test.ts:3817` duplicates `:3813`; `:3814` is subsumed by `:3818`.

## Round 2 — verdicts at `d54d8ae`

| Axis | Verdict | Independently reproduced |
|---|---|---|
| Repository standards | **PASS** | `npm run typecheck` exit 0; focused 164 passed; full 285 passed / 10 files; `grep -n 'lint' package.json` exit 1 |
| Specification fidelity | **PASS** | all six FRs implemented in the range; the amended `## Amendments` enumeration matches the spec diff one-for-one; `grep -rc "harness-failed" src/` → 13 + 16 = 29 |
| Unnecessary complexity | **PASS** | gates reproduced at HEAD; confirmed the `readIssueLabels` seam, the two `try` blocks and the test knobs are each the earliest rung that works |
| Evidence and risk integrity | **PASS** | ran the sweep itself (29); reproduced the filter's 14 survivors and the 15 omitted; reproduced the RED in a throwaway copy — `2 failed \| 162 passed (164)`, failing at the `setIssueLabel` assertion, no compile error |

The remedy was verified by execution rather than description: the evidence axis ran the printed
command against the tree and confirmed the enumeration line-for-line, including the boundary lines
`src/loop.ts:225,318,782,800,1157,1228,1664,1826,1958,2198,2751,2985` and the five
`src/loop.test.ts` comment lines.

## Findings — round 2 (all adjacent, none blocking)

Six findings, all in `docs/work/WI-15/verification.md`, corrected in `e12d8f4`:

| Finding | Raised by |
|---|---|
| A sentence stated the **opposite** of its own finding — that the old table "could not have been incomplete", when the finding is that it was incomplete (14 of 29) | evidence/risk |
| The FR-005 evidence row called all 16 `src/loop.test.ts` occurrences "fixture string literals"; 5 are comments | evidence/risk, and specification independently |
| The corrections table omitted two of `d54d8ae`'s own corrections while its prose called the list complete | evidence/risk |
| FR-004's proving command (`grep -E '^[-+].*LoopOutcome'`) could not detect a field added inside the interface body | evidence/risk |
| The identity table's "Corrected candidate" row could not name its own commit and went stale for later readers | complexity and standards, independently |
| Three `describe(…)` suite titles were labelled fixture text | evidence/risk |

Two findings — the mislabelled occurrence count and the un-instantiable identity row — were reached
independently by two axes each, which is the strongest signal either could carry.

## Findings deferred, not corrected

- **`src/loop.test.ts:3817` / `:3814`** — a duplicate and a subsumed assertion. A `src/` edit would
  void both current verdicts for a cosmetic duplicate; recorded as ask (j) and left to the owner.
  **Resolved 2026-09-24** (owner decision) on the follow-up branch: both lines deleted. The verdicts
  they would have voided already described a delivered tree once this branch merged. Coverage
  preserved, proven by mutation rather than argued — see the note in `implementation-notes.md`.
- **`docs/work/WI-6/evidence/canary-red-driver.ts:114`** — a `QueueLoopDeps` literal still carrying
  the two properties WI-13 retired (`runTriage`, `triage`) and missing **eight** required deps added
  since: `branchConflictsWithMain`, `commentOnIssue`, `pushBranch`, `readIssueLabels`,
  `refreshRemoteRefs`, `runMerger`, `runPlan`, `setIssueLabel` — six from `LoopDeps` (`runMerger`,
  `branchConflictsWithMain`, `pushBranch` — WI-13; `commentOnIssue`, `setIssueLabel` — WI-14;
  `readIssueLabels` — WI-15), one from `QueueDeps` (`refreshRemoteRefs`, WI-7), one from the inline
  `runPlan` constituent (WI-13). Outside `tsconfig.json`'s include.
  Pre-existing; WI-15 deepens existing rot rather than creating it. *Corrected twice, 2026-09-24 —
  this entry first said "carrying neither `setIssueLabel` nor `readIssueLabels`, uncompilable since
  WI-14", naming two and dating the break one work item late; then said **six**, which is what
  TypeScript reports, because an intersection failure is reported through one constituent only and
  the list is truncated ("…and 2 more"). Enumerating all three constituents against the literal's
  keys gives eight. `delivery.md` risk 4 carries the proving commands.*
- **The corrections-section redundancy** (complexity recommended deleting the table and the spec
  parenthetical) — kept deliberately. Both are the audit trail for the round-1 blocking finding;
  deleting review-finding evidence to satisfy a taste axis is the wrong trade. The divergence from
  WI-9's "corrections by addition, nothing rewritten" house style is **settled 2026-09-24: both
  behaviors are kept**, chosen by the artifact — standing claims (`delivery.md`, `review.md`,
  `verification.md`) are corrected in place, a chronological ledger (`implementation-notes.md`) gets
  an appended note. The rule is written down in `CLAUDE.md` under *The lifecycle*.
- **FR-006's "one line" vs the two `## Lessons` lines delivered** — both true, both this work item's
  defect classes, and `CLAUDE.md`'s standing self-learning rule asks for a line per caught mistake.
  The spec text is one line behind the delivery; routed to the owner rather than amended unilaterally.

## Missing evidence and explicit non-claims

- **The two `gh` subprocess calls are never exercised by vitest** — `readIssueLabels`
  (`src/loop.ts:2782-2789`) and `setIssueLabel` (`:2761-2769`). No live run was bought (prd decision
  7). Their correctness rests on review plus `docs/work/WI-15/evidence/label-state-probes.log`.
- **`build:image` / `smoke:image` were not run** — no `Dockerfile` or `scripts/` change, so the image
  result is candidate-independent. Not run by any reviewer either.
- **No lint step exists or was invented**, by the review or by the change.
- **The probes are recorded, not re-run** — Part 2 is copied verbatim from `prd.md`, Part 3 is a
  local `stdio` reproduction. Consistent with the no-live-run decision; stated as a non-claim.

## After the verdicts — the correction commit `e12d8f4`

Round 2's six findings were corrected in `e12d8f4`, a docs-only commit. **Those corrections postdate
all four verdicts**, so by this repository's own standard the verdicts describe `d54d8ae` and nothing
later. Rather than buy a third full four-axis pass over a docs-only delta, the evidence/risk axis —
the one that found five of the six — was asked to re-check only the rows it found, and to **run** the
replacement commands rather than read the figures.

Its answer: **PASS** on all six rows. It ran the replacement commands rather than reading the figures
— the interface-body diff yields a single hunk in which every changed line is a ` * …` JSDoc line and
`grep -c readonly` is 22 on both sides; the field-usage grep yields 7 lines, all uses, none a
declaration. It also enumerated every changed line of `d54d8ae`'s own diff and confirmed each maps to
a round-1 table row, and confirmed the FR-002 sweep and the corrected pointers still reproduce.

Two things that answer did *not* settle, stated rather than smoothed over:

- **The three other axes' round-2 PASSes rest on this file**, which was untracked when the answer was
  given. They are mine, reported from reviews I dispatched and read; the evidence axis did not
  independently reproduce the other three, and said so. This file is the artifact that carries them,
  so it lands on the branch with them.
- **`verification.md`'s citation of this file resolves one commit later than the commit that makes
  it.** At `e12d8f4` the tree does not yet carry `review.md`, and `verification.md:290` says its
  answer "is recorded in `review.md`" in the present tense. Both statements are true of the delivered
  branch and of the PR diff, which is reviewed as a whole; at `e12d8f4` in isolation they are
  forward-looking. Recorded here so no reader has to discover the ordering.

**What this re-check is not.** It is a targeted verification of six rows by the axis that found five
of them — not a fifth axis verdict, and not a re-review of the branch. The four round-2 verdicts
describe `d54d8ae`, and the correction commit and this record both postdate them.
## Round 3 — the follow-up branch, `d54d8ae..0a54a66`

Round 2's verdicts describe `d54d8ae` and the delivered PR. The follow-up branch
`wi-15-followup` then added six commits on top of the merge `0b46971`, and one of them —
`72faee7` — changes `src/`: it deletes the two assertions risk 5 deferred. A `src/` change is
outside everything round 2 reviewed, so a fresh four-axis pass was run over the follow-up range.
Same four axes, same isolation, no access to each other's context.

| | |
|---|---|
| **Fixed point** | `d54d8ae` (the round-2 candidate; also the merge-base) |
| **Candidate** | `0a54a66` — `d54d8ae..0a54a66`, 11 commits, 13 changed paths |
| **Authority** | none. The follow-up has **no approved specification** — see the fidelity axis below |

| Axis | Verdict |
|---|---|
| Repository standards | **FAIL** — one hard violation |
| Specification fidelity | **UNVERIFIED** — no approved specification exists for this range |
| Unnecessary complexity | **PASS** — five non-blocking recommendations |
| Evidence and risk integrity | **FAIL** — two blocking findings |

### Repository standards — FAIL

**Hard violation: the range does not apply the rule it writes down.** `CLAUDE.md` gains (via
`0cd33bb`) the rule that a *standing claim* is corrected in place, and names `delivery.md`,
`review.md` and `verification.md` as the artifacts it governs. `72faee7` — a commit in this same
range — makes `git log -1 --format='%H %s' -- src/` return `72faee7` rather than `eaf006e`, and
those three artifacts were left carrying the claim it falsified. Several were self-falsifying: the
sentence sat directly above the command that disproves it. The axis called it "a selective
application rather than an unconsidered one", because the rule *was* applied elsewhere in the same
range.

*Remediated in this pass.* All of the named claims — `delivery.md` §Verification,
`delivery.md:53`'s vitest row, the "never pushed" branch row, "nothing was merged",
`review.md:15`/`:32`, `verification.md:10`/`:24`/`:48` — were corrected in place, each carrying the
command that proves the new figure.

Judgement calls, none blocking: the four-verdict summary is restated in four artifacts (suppressed
for the corrections table, which `review.md` endorses keeping deliberately); three files added by
the range lacked a final newline (fixed in this pass); `SKILL.md:21` cites
`docs/agents/project-policy.md`, which does not exist (suppressed — `implementation-notes.md`
flags it deliberately and two sibling skills cite it too); `CLAUDE.md`'s lesson about 16 drifting
skills while only `code-review` was fixed (suppressed on owner authority, `delivery.md` row 9).
Clean: module table honest, no lint step invented, branch and worktree follow `workflow.md`.

### Specification fidelity — UNVERIFIED, not a pass

The axis refused to grade this, and was right to. The tail's four commits touch no file any
FR-001…FR-006 criterion names, and the follow-up has no approved specification at all: its nearest
authority is `delivery.md` rows 1–10, several of whose justifications ("widened WI-6 pointer",
rows 5, 7, 9, 10) rest on session instructions that exist in no file. Those rows were themselves
rewritten by the follow-up (`704f443`, `dbc2bc8`, `a82127b`), so a row saying "owner chose
2026-09-24" is the follow-up recording itself. Per the review contract, a missing specification
does not receive a specification pass.

Findings it did raise:

- **(a)** Row 10's own rule is under-applied at home — risk 6 and `verification.md` entry (k) were
  not corrected in place alongside risks 4–5.
- **(b) Not asked for:** the `smells.md` baseline was **swapped** rather than moved (row 9 asked
  only for "the four axes actually run"); `agents/openai.yaml` is new and row 9 names no file; the
  `CLAUDE.md` lifecycle rule adds a third normative clause beyond row 10's "keep both".
- **(c) Looks implemented, is wrong:** three false claims inside `implementation-notes.md` — the
  frontmatter described as "defined **two** … promised four" (it read "along two axes"; the real
  drift was record-vs-skill), "the **six** sibling skills that ship one" (seven at `0b46971`), and
  row 6's Notes cell recording one labelled file where three were labelled.

*Items (c)'s first two were corrected in the earlier pass by appended ledger note; the smell swap
was recorded rather than corrected and is still the owner's open call.*

### Unnecessary complexity — PASS

Five non-blocking `delete`/`shrink` recommendations, none asking for a code or behavior change:
the verbatim PR-body quotation in `delivery.md` (~40 of ~45 lines duplicating this record's own
Summary); the round-2 restatement in `implementation-notes.md`'s stage-4 section; risks 4–5
re-enumerating what the ledger note already lists; a doubled reason clause in `CLAUDE.md`'s ledger
rule; and the "earlier, blunter attempt" paragraph (lowest confidence). Explicit no-change results
were returned for the four-axis table, `smells.md`, `agents/openai.yaml`, the three WI-6 banner
lengths, the two new `## Lessons` lines, and the `src/loop.test.ts` deletion.

**Held, not applied.** These are taste recommendations against artifacts whose job is to be
re-readable, and each proposed deletion removes context a different reader needs. Recorded as
available, not taken.

### Evidence and risk integrity — FAIL

Gates were run at HEAD and all three record figures matched: `npm run typecheck` exit 0;
`npm test` → `285 passed (10 files)`; `npx vitest run src/loop.test.ts` → `164 passed`. The axis
verified the two-line deletion against out-of-tree mutation probes (both `1 failed | 163 passed`),
confirmed subsumption from source, and reproduced all four TypeScript positions.

**Blocking findings — both the vacuous-evidence class this work item exists to remove:**

1. `delivery.md` §Verification prints `git log -1 --format='%H %s' -- src/` → `eaf006e`; at HEAD
   that command returns `72faee7`.
2. Inside the range's own corrections: risk 3 cited siblings at `:3821`/`:3935`, which are **blank
   lines** at HEAD, and risk 4 cited a last-touch of `aa6f2e0` where HEAD gives `704f443`.

*Both remediated in this pass.* Also corrected: `delivery.md:23`'s "`0d371ef..HEAD` — the PR's real
figures (12 files, +2527/-44)", which the axis flagged as "anchored to creation time, off by 54
insertions".

**Where this record disagrees with the axis, on measurement.** The axis reported the driver's
missing-dep count as **seven** — six from `LoopDeps` plus `runPlan`. Enumerating all three
constituents against the literal's keys gives **eight**: it additionally omits `refreshRemoteRefs`
from `QueueDeps`, required since WI-7. The axis reached seven by adding only the constituent it
thought of, which is the same one-constituent blindness it had just diagnosed in the compiler.
Eight is the measured figure; `delivery.md` risk 4 carries the command.

**Adjacent observations.** Two the range had not recorded: `delivery.md`'s "real figures" anchor,
and the in-flight `git branch -r --contains` claim — *mine*, printed without being run, and
corrected in this pass. And one about this session rather than the branch: **"Tree changed under
me, not by me."** The worktree was clean when the axis started and had seven modified files by
18:56; every write it made was under `/tmp`, and it correctly declined to restore files it did not
own. The causes were my corrections landing while it read. The axis's figures are still sound — it
measured `src/`, which none of my edits touched — but a review whose candidate moves under it
cannot certify the moved files, and this one does not claim to.

### What round 3's verdicts do and do not cover

They describe `d54d8ae..0a54a66`. Every correction made in response — the ones remediating the two
FAIL axes, the additional errors this record lists, and the `CLAUDE.md` lesson edit — **postdates
all four verdicts**. By this repository's own standard those verdicts therefore do not certify the
corrected tree.

That is stated rather than papered over, and the honest consequence is that the follow-up branch
carries a remediation pass with **no verdict of its own**. What can be said without a further
review: both blocking findings are the printed-command class, the corrections to them were
re-measured rather than adjusted, and the `src/` tree is untouched by every one of them —
`git diff --stat` across this pass touches `docs/` and `.claude/skills/` only, plus three
`CLAUDE.md` lesson lines. Whether that is enough to skip a fourth pass over a docs-only delta is
the owner's call, not this record's.
