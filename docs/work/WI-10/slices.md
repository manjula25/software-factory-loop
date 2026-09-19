# WI-10 Slices

Dependency-ordered slices for the red-canary/revert live proof
(carve-out: `docs/work/WI-10/prd.md`).

## Slice 1 — Seed + conflicting-test preparation (FR-001)

Seed one dormant bug + one open issue on `manjula25/loop-fixtures-py`
(zero LLM except one ledgered probe); prepare the conflicting-test commit
locally, ready to push mid-run. Evidence: fresh-clone suite green,
preflight MATCH, issue OPEN, the prepared commit shown to pin the buggy
behavior.

## Slice 2 — The live run with the timed push (FR-002/FR-003)

Single real-LLM run; orchestrator pushes the conflicting test inside the
fix-agent window; observe the full chain: verification green → diff review
approve → squash merge → canary RED → auto-revert → run halt → @-notify.
Evidence: verbatim run log, timing record of the push relative to the
phases, spend ledger (1 probe + 1 fix run per attempt, per the approved
re-drive budget).

## Slice 3 — End-state verification and record (FR-004)

Fresh gh read-backs: revert commit on fixtures `main` (merge reverted,
conflicting test intact and passing on the reverted main), merged PR with
the notify comment, issue still open; verification record with non-claims
(the reverted surface's live claim now covers the current tree; uncanaried
and teardown failure paths remain unit-evidence-only).
