---
name: code-review
description: Use when reviewing a fixed non-empty candidate against repository standards, specification, evidence integrity, and unnecessary complexity.
---

# Code Review

Four axes, each a read-only reviewer with no access to the others' context, kept separate and never
merged — a change can follow every standard and still implement the wrong thing, and reporting one
axis' result as another's is how that goes unnoticed. `review.md` carries all four verdicts.

The tracker is GitHub Issues on `manjula25/software-factory-loop` (policy:
`docs/agents/issue-tracker.md`); work items are referenced as `WI-<n>`.

## Required inputs

A valid non-empty fixed point, exact candidate identity, and access to every changed file.

## Optional inputs

Approved specification, `docs/agents/project-policy.md`, repository standards, verification record,
and [the smell reference](smells.md).

## Required companion skills

None.

## Output

`docs/work/{WORK_ITEM_ID}/review.md` with candidate identities, changed-path accounting, separate
axis verdicts, classified findings, and unverified evidence.

## Process

1. Pin the fixed point. Whatever the user named — a commit SHA, branch, tag, or `main` — resolve it
   (`git rev-parse <fixed-point>`) and confirm the range `git diff <fixed-point>...HEAD` is
   non-empty, along with `git log <fixed-point>..HEAD --oneline`. Both immutable identities are
   pinned here. A bad ref or an empty diff fails **here**, not inside four reviewers.
2. Enumerate and account for every changed file. Read repository policy, standards, approved
   artifacts, and relevant source rather than reviewing a summary alone.
3. Identify the specification, in this order: an issue reference in the commit messages (fetch via
   `docs/agents/issue-tracker.md`); a path the user passed; the work item's
   `docs/work/{WORK_ITEM}/specification.md`. Product-level questions resolve against
   `harness-prd-v2.md`. If no specification exists, that axis is **unverified** — never a pass.
4. Identify the standards sources: anything in this repo that documents how code should be written.
   On top of them the standards axis always carries the smell baseline in [smells.md](smells.md),
   under two binding rules — **this repo's documented standards override the baseline**, and every
   baseline smell is a judgement call, never a hard violation. Skip anything tooling already
   enforces.
5. Run the four axes as separate read-only reviewers, one per axis, dispatched in a single message
   so they run concurrently, with no access to each other's context:

   | Axis | The question | Carries |
   |---|---|---|
   | **Repository standards** | Does the change conform to this repo's documented standards? | the diff, the standards sources, [the smell baseline](smells.md) |
   | **Specification fidelity** | Does it implement what the originating spec asked? | the diff, the specification |
   | **Evidence and risk integrity** | Do the record's claims match what its own commands produce? | the diff, the verification record, the verification commands in `docs/agents/workflow.md` — and the authority to **run** them |
   | **Unnecessary complexity** | Is anything built that the specification does not need? | the diff, the specification |

   The evidence axis reads figures by **running** the commands, not by trusting the record. A
   printed command that does not produce the table beneath it is the failure this axis exists to
   catch, and it is the axis most likely to find a blocking finding.
6. Keep the verdicts separate. Never merge or rerank them, and never report one axis' result as
   another's. Classify findings by severity, distinguishing blocking findings, adjacent
   observations, and missing evidence.
7. Write `review.md` for the exact candidate. If candidate identity changes, discard the verdicts
   and review the new range.

## Completion criterion

Every changed file is accounted for, all four axes have evidence-backed separate verdicts, blocking
findings and unverified gaps are explicit, and the review applies to the exact candidate.

## Stop conditions

Stop when the fixed point is invalid, range is empty, ancestry is invalid, candidate changes, changed
paths cannot be inspected, required policy is unavailable, or evidence needed for a verdict is
missing.

## Next recommended skill

Recommend `finishing-a-development-branch` only when blocking findings are resolved and verification
remains fresh. A commit landing after the verdicts means those verdicts describe the earlier
candidate — say so in `review.md` rather than leaving a reader to assume they cover the later tree.