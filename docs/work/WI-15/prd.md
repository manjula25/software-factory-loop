# WI-15 — Label removal decides from label state, not error text

**Status:** Grilling complete 2026-09-23; owner approved every decision interactively
(this file is the record).

## Origin

**A9**, recorded at WI-14 and deferred there as a non-blocking follow-up with an owner:
`docs/work/WI-14/implementation-notes.md:85` (first raised at the T2 quality rerun as
UNVERIFIED), `:195` (deferred to T3 by controller instruction, then to T5), `:274` (T5 live
non-claim); `docs/work/WI-14/verification.md:124`; re-raised by the Spec axis at the
branch-level review (`docs/work/WI-14/review.md:181`, "re-raised deferral — the owner may
override"); `docs/work/WI-14/delivery.md:96` (remaining risk 1 — "the one finding with a
reachable operator-visible consequence, and the owner can override at merge time").

WI-14 is delivered and merged (`0d371ef`). **This is the follow-up, not a WI-14 edit** — those
records stand as the record of what was believed at delivery (decision 9).

## Facts verified before grilling (2026-09-23)

Code reading, plus five probe commands run against `manjula25/loop-fixtures-py` (a public
synthetic fixture repo, so hard constraint 3 is not engaged) on **gh 2.45.0**. The probes are
outward-facing `gh` calls on a non-mutating case each; the owner authorized each batch.

- **Reading labels works.** `gh issue view 54 --json labels,state` → `{"labels":[],"state":"CLOSED"}`, exit 0.
- **Removing a label that exists in the repo but is not applied to the issue succeeds
  silently.** `gh issue edit 54 --remove-label harness-failed` → exit 0, no stdout, no stderr.
  `gh` is already idempotent for the very case the classifier was written to forgive.
- **Removing a label that does not exist in the repo fails**, and the text **matches** the
  current classifier: `failed to update <url>: 'no-such-label-xyz' not found` +
  `failed to update 1 issue`, exit 1.
- **Removing a label from a nonexistent issue fails**, and the text **does not match**:
  `GraphQL: Could not resolve to an issue or pull request with the number of 999999.
  (repository.issue)`, exit 1.
- **`harness-failed` still exists on that repo** (read-only check), so the probe above really
  was "label in repo, not on the issue" — not "label deleted".
- **A9's stated failure mode is therefore disproven as written.** A9 says "a genuine
  issue-not-found error during a remove would be swallowed as success" — that exact error is
  the `Could not resolve …` message, and it does **not** match the classifier. It rethrows and
  is recorded.
- **What survives is narrower, and differently shaped.** The classifier *is* reachable — but
  only in the repo-label-deleted case, where forgiving is the **correct** outcome (FR-005's
  boundary: "a missing label is success"). The real residual problem is not a wrong verdict but
  a **silent** one: an unforeseen error whose text happens to contain one of the five phrases is
  forgiven **with nothing recorded at all** — `clearHarnessFailedLabel` (`src/loop.ts:798`)
  returns `{}`, so `escalationLabelFailure` is never set, so not even the summary line fires.
  That contradicts FR-005's own wording, "a failed removal is recorded as a summary line only."
- **`setIssueLabel` is wiring-only, not exercised by vitest** (`src/loop.ts:2717–2719`);
  `clearHarnessFailedLabel` is reached through `LoopDeps` and *is* covered by the existing
  T3/T3b tests in `src/loop.test.ts` — so moving the decision into it makes the decision
  testable, where today the same decision hides inside the untestable wiring.
- **The label literal `"harness-failed"` appears in three non-test places** (`src/loop.ts:2725`,
  `:2949`, `:2958`); the new membership check makes it a fourth.

## Grilling decisions (owner, 2026-09-23)

1. **The work is done, not accepted as residual risk** — despite the effect being bounded and
   self-healing (the next failing run re-adds the label, the next successful one retries the
   removal), because the code's *stated* intent is already narrow ("the wiring's classifier
   treats **a missing label** as success", `src/loop.ts:793–796`) and FR-005's boundary says the
   same — so this is a precision repair, not a semantics change.
2. **Decide from state, not from text.** The removal reads the issue's label list and only calls
   remove when the label is actually applied; the error-text classifier is **deleted outright**,
   both directions of string matching gone. *(Owner chose the read-at-the-removal-site option
   over folding `labels` into acquisition. The acquisition variant was rejected because its
   reading is from run start: a human un-labeling mid-run would send the harness into a remove
   call that errors, re-breaking the one out-of-band case FR-005 names explicitly.)*
3. **A failing read is recorded and the removal is skipped** — never guess-and-proceed (which
   would just move the inference back into an error string), never silently skipped (which is
   A9 again with extra steps). The label is self-healing, so a skipped removal costs one run's
   staleness and nothing else.
4. **One field, one line.** A failed read and a failed removal both record into the existing
   `escalationLabelFailure`, rendered by the existing `LABEL REMOVE FAILED <id>: <reason>` and
   `harness-failed label remove failed: <reason>` lines — unchanged wording. On a read failure
   the reason text is prefixed so it says which step failed (`could not read the issue's
   labels: <err>`). No new outcome field, no new line, no `CLAUDE.md` vocabulary change.
5. **Scope: the remove arm only.** The add path has no classifier to get wrong; the
   `ensureHarnessFailedLabel` create-time check (`/already exists/i`, `src/loop.ts:2955`) is
   narrow, was exercised live in T5, and fails **loudly** (the run aborts before any spend) —
   the opposite of A9's silent problem. Untouched.
6. **One shared constant** for the label name, so the create, the edit and the membership check
   cannot drift apart. *(Owner: yes.)*
7. **Proving: seam tests plus the recorded probes; no live run.** The decision logic is covered
   by dep-injected vitest (RED first) across all four cases; the five probes are recorded
   verbatim as evidence; **the wiring inside `main()` stays a stated non-claim** — the same
   posture `setIssueLabel` already has today. *(Owner chose the probe level over a full live
   run: T5 already drove the removal arm end-to-end, this change only inserts one read before
   it, and a live run would re-burn Docker + agent spend to re-prove an already-watched chain.)*
8. **Process: the light chain** — grilling (this record) → spec → plan; **`to-tickets` is
   skipped** (one slice, no dependency graph to sequence) with the reason recorded in the plan.
9. **A new work item; WI-14's records are not amended.** Those files are evidence of what was
   believed at delivery, and rewriting them after the fact destroys the trail. The corrected
   understanding lives here and in WI-15's spec/verification.

## Corrected understanding (replaces A9's description)

A9 as recorded describes a wrong-verdict bug ("a genuine error swallowed as success"). What the
probes show is a **silence** bug: the reachable forgiveness is correct, and the danger is that
an *unforeseen* error would be forgiven with **no record at all**. WI-15's design removes the
forgiveness entirely, so nothing can be silently excused — the failure class is eliminated by
construction rather than by tightening a phrase list.

Process note, recorded honestly: the controller recommended the state-based fix, briefly
retracted it after probe 2 (which looked like proof the classifier was unreachable dead code,
on the same footing as WI-14's T2 blocking defect), then reinstated it after probe 4 showed the
classifier *is* reachable — in the one case where forgiving is right. The retraction was
premature: the classifier's reachability was not settled until probe 4, and the design question
was never "is it dead" but "what should the read decide".

## Non-claims (agreed boundaries)

- **The wiring is not proven end-to-end.** The new `gh issue view` call and the remove call
  inside `main()` get no live run; their correctness rests on code review plus the recorded
  probes, and this is stated as a non-claim in `verification.md`.
- **No semantic change to FR-005.** The label still means "currently failing"; a missing label
  is still success; a failed removal still changes nothing but the summary line. Reading first
  is a stricter implementation of the existing boundary, not a new contract.
- **No PRD amendment.** This fixes the implementation of an existing boundary and adds no
  product scope, so `harness-prd-v2.md` is untouched.
- **No retroactive edit of WI-14's records**, including the A9 text this record corrects.
- **The lesson from this grilling lands with the code**: a subprocess classifier's reachability
  must be probed across *all* its cases before it is called dead — probe 2 alone (label absent,
  exit 0) looked like proof of dead code; probe 4 (label not in the repo) is the case that fires
  it. One line for `CLAUDE.md` `## Lessons`, added in the WI-15 PR.

## Next recommended skill

`to-spec` — measurable FRs traced to this record, then `writing-plans` (tickets skipped, per
decision 8).