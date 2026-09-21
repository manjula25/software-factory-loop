# WI-14 — Escalation/notification for failed fix attempts

**Status:** Grilling complete 2026-09-20; PRD amendment drafted.
Owner approved every decision interactively (this file is the record).

## Origin

User direction 2026-09-20: bring the escalation/notification item into scope as
the next work item — parked in the PRD's out-of-scope list (line 105:
"Escalation/notification mechanism for issues that fail all fix attempts"). The
triggering gap: a failed fix is recorded honestly in the run summary today, but
nothing *tells* anyone — the failure sits in a log until a human happens to read
it.

## Facts verified before grilling (2026-09-20)

- **Within a run, each issue gets exactly one attempt.** The wave runner's
  `attemptedIds` set (`src/loop.ts:1751`) guarantees an issue is never
  re-attempted in a later wave of the same run.
- **Across runs there is no memory.** A failed issue's branch is deleted and the
  issue reappears in the queue on the next manual run — retried every run,
  silently. The PRD's "no run-record state" principle (line 84) is deliberate.
- **`notifyHandle` is an optional `ProjectProfile` field** (`src/loop.ts:94`),
  read at notify time — the same single handle the canary-red/revert/halt chain
  uses, with the WI-11/12 absent-vs-@-rendered vocabulary.
- **No non-GitHub notification channel exists anywhere in the harness.**

## Grilling decisions (owner, 2026-09-20)

1. **"All fix attempts" = per-run.** One attempt per run; when that attempt
   fails, the escalation fires. No cross-run attempt counting, no new persistent
   state — the no-run-record-state principle stands. (Owner: (a) over cross-run
   exhaustion and hybrid options.)
2. **Channel: comment on the failed GitHub issue carrying `@<notifyHandle>`.**
   Same handle, same vocabulary as the canary/revert/halt chain. When no handle
   is configured, the comment still posts with no `@` and the summary says
   "notify handle not configured" — the established D6 behavior.
3. **Trigger: exactly the outcomes where a run leaves an issue unfixed with no
   visible artifact of its own** — the `fail()` family: repro-test failure,
   verification failure, preflight/sandbox failure. Outcomes that already leave
   an open PR (review-uncertain, merge-failure posture, canary-red) keep their
   existing surfaces; no double-pinging.
4. **Comment content: minimal, evidence-pointing.** `@<handle>`, outcome class,
   the **verbatim** failure reason (already secrets-screened at the emission
   seam), and a pointer to the full log. No log excerpts in the comment body —
   no new secrets surface.
5. **Timing: inline at the moment the lane fails.** Posting-failure posture
   mirrors WI-11 teardown recording: the posting failure is recorded verbatim in
   the summary ("escalation comment failed for gh-N: <reason>"), the verdict
   stands untouched, never a silent retry.
6. **The issue also gets a `harness-failed` label.** *(Owner chose (b)
   comment+label over the recommended comment-only — recorded as the owner's
   call.)*
7. **Label lifecycle: the label means "currently failing."** Removed when a
   later run succeeds on the issue (PR delivered / issue closed). Label name
   `harness-failed`. A failed label-add/remove is a summary line only, same
   recording posture as decision 5. Note: this label is the harness's first
   cross-run *tracker* state; it lives in GitHub, not in the harness, so the
   letter of the no-run-record-state principle holds.
8. **Both surfaces.** The escalation fires in queue mode and in single-issue
   mode — one behavior everywhere a fix can fail. No "someone was probably
   watching" exception.

## Non-claims (agreed boundaries)

- **Non-GitHub issue sources** (spec docs, plain lists — WI-3b) have no issue to
  comment on or label: they degrade to the run-summary line only. No new channel
  is invented for them.
- **Not-failed ≠ notify.** Skipped-as-duplicate, blocked-by-dependency, and
  cut-by-cap issues do not notify — they are not failures.
- **No cross-run suppression.** Two failing runs on the same issue produce two
  comments. Suppression would require the cross-run state decision 1 rejected.

## PRD amendment

`harness-prd-v2.md` out-of-scope line 105 gains the WI-5/WI-13-style amendment
note naming this record and bringing the item into scope.

## Next recommended skill

`to-spec` — measurable FRs traced to this record, then the standard planning
chain.
