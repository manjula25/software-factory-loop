# WI-15 — Code Review

Four axes, each a read-only reviewer with no access to the others' context, run twice: once at
`5946199` and again at `d54d8ae` after the first round's corrections. Verdicts are kept separate and
never merged — a change can follow every standard and still implement the wrong thing, and reporting
one axis' result as another's is how that goes unnoticed.

## Candidate identity

| | |
|---|---|
| **Fixed point** | `39d1b26` (`main`; the merge-base, and the T0 planning-chain commit) |
| **Round-1 candidate** | `5946199` — `39d1b26..5946199`, 11 commits, **8** changed paths |
| **Round-2 candidate** | `d54d8ae` — `39d1b26..d54d8ae`, 12 commits, the same **8** paths |
| **Source identity** | `eaf006e` — the last commit touching `src/` |
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

So every commit after `eaf006e` is docs-only, and both rounds reviewed the same `src/` tree.

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
- **`docs/work/WI-6/evidence/canary-red-driver.ts:114`** — a `QueueLoopDeps` literal still carrying
  the two properties WI-13 retired (`runTriage`, `triage`) and missing **six** required deps added
  since (`branchConflictsWithMain`, `runMerger`, `pushBranch` — WI-13; `commentOnIssue`,
  `setIssueLabel` — WI-14; `readIssueLabels` — WI-15), outside `tsconfig.json`'s include.
  Pre-existing; WI-15 deepens existing rot rather than creating it. *Corrected 2026-09-24 — this
  entry said "carrying neither `setIssueLabel` nor `readIssueLabels`, uncompilable since WI-14",
  naming two of the six and dating the break one work item late. Proving commands in the correction
  note in `implementation-notes.md`.*
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