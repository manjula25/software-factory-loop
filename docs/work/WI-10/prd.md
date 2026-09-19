# WI-10 — Red-canary/revert live proof (PRD carve-out)

Carved from `harness-prd-v2.md` (the PRD wins on any disagreement): user
story 6 (amended 2026-09-18) and the "Review and merge gate" section —
"Every auto-merge is followed by the canary (full suite on main in a fresh
sandbox); red → auto-revert, run halt, immediate @-mention notification on
the merged PR" — plus implementation decision 5's compensating-controls
rationale. This is a verification/evidence work item in the WI-9 mold: no
harness behavior change is in scope.

## The gap

WI-9 closed the standing pipeline-integration non-claim for the **happy
path + deferral/re-admission** on the delivered tree. The compensating
controls that justify opt-in auto-merge at all — canary red → auto-revert →
run halt → @-notify — remain live-proven only on the older WI-6 T7 tree
(LLM stubbed). Nothing on the current tree with a real LLM fix run has ever
gone through a red canary.

## Scope

1. **Seed (zero LLM except one probe):** one new dormant bug in
   `manjula25/loop-fixtures-py` with one open self-authored issue (WI-1
   style); suite green; baseline MATCH. Additionally prepare — but do NOT
   push — a "conflicting test" commit: a new test on fixtures `main` that
   pins the *buggy* behavior the fix will change (a plausible
   another-developer-already-pinned-this scenario).
2. **The live run (real LLM, single-issue, local Docker):** run the loop on
   the seeded issue. While the fix agent works (its window observable via
   the sandbox log tail), push the prepared conflicting test to fixtures
   `main` — after the fix branch's base is pinned, before the merge. The
   fix then passes its fresh-sandbox verification gate (the conflicting
   test is not on the branch), the pre-merge diff review approves, GitHub
   squash-merges cleanly (new test file — no textual conflict), and the
   canary suite on merged main goes **red**: the compensating controls must
   fire — revert on `main`, run halt, @-notify comment on the merged PR.
3. **The record:** verbatim run log, fresh gh read-backs of every
   end-state (revert commit on `main`, merged-then-reverted PR state, the
   notify comment, the issue left open), spend ledger, and honest
   non-claims.

## Why the induction is legitimate

The scenario is exactly the one the canary exists for: a fix that is
verified-green on its own branch but wrong for the `main` it actually lands
on. The orchestrator manufactures the race deterministically instead of
hoping for one; the harness's behavior is untouched and unstubbed.

## Out of scope (unchanged from WI-9's posture)

- No harness `src/` changes; any defect the run exposes goes through the
  normal in-loop TDD path (WI-9 FR-004 precedent) or back through the
  lifecycle if beyond repair scope.
- No fault injection into harness failure paths (uncanaried merge,
  teardown throws) — unit evidence stands; only the red-canary/revert path
  is live-proven here.
- No cloud, no client data, no cost figures; self-authored synthetic data
  only (constraint 3), local Docker only (constraint 6).
- No re-drive past the legitimately red canary: the revert **is** the
  success evidence (WI-9 Clarification (a) posture). Post-revert cleanup
  of the fixtures repo (the conflicting test stays, pinning the bug; the
  issue stays open) is recorded, not silently tidied.

## Open design decisions (for the spec stage)

1. **Timing-failure path:** if the conflicting-test push lands too early
   (verification goes red on the branch → fix fails) or too late (merge
   already canaried green), how many re-drives are allowed and at what
   spend?
2. **Run mode:** single-issue override (`--issue <n>`, deterministic, no
   triage spend) vs. queue mode with exactly one eligible issue.
3. **Post-revert end-state:** confirm stop-at-revert (issue open, no
   follow-up fix invocation in this work item).
