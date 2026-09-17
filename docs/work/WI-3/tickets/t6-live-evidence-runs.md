# T6 — Live evidence runs

## What to build

Two pipeline-integration runs that exercise WI-3's new surfaces live, in Docker,
against the seeded fixtures repo (`manjula25/loop-fixtures-py`) — the same
evidence-shape as WI-2's T5:

1. **Attachment fetch live**: a run over the fixtures issue whose body links the seeded
   uploaded attachment (`loopfix-issue3-session.log`, verified present 2026-09-16) —
   with the profile cleared — proving the live redirect chain
   (302 → presigned → 200), delivery into the sandbox, excerpt in the prompt, and the
   issue processed normally.
2. **Non-GitHub source end-to-end**: a run driven by a spec-doc (or plain-list) file
   authored against one seeded fixtures bug, proving preflight → fix → fresh-sandbox
   verify → PR on a `fix/spec-*`/`fix/list-*` branch.

Both runs' summaries are preserved verbatim under `docs/work/WI-3/evidence/`, and a
gate-refusal check (uncleared profile + attachment → named error, no fetch) is recorded
from the same setup.

## Blocked by

T2 (fetch/delivery must exist), T5 (a non-GitHub source must be selectable).

## Requirement coverage

FR-003 and FR-008 integration labels (plus a live confirmation of FR-002's refusal);
slice 1 and slice 4 pipeline-integration expectations; PRD L92 (integration against
seeded repos).

## Acceptance criteria

- [ ] Live attachment run: attachment bytes land in the sandbox, prompt contains the
      excerpt, run completes normally; summary preserved verbatim.
- [ ] Non-GitHub source run: PR opens on a `fix/spec-*` or `fix/list-*` branch with
      RED/GREEN evidence, fresh-sandbox verified, nothing merged; summary preserved
      verbatim.
- [ ] Gate-refusal record: uncleared profile + attachment URL → named gate error, no
      network fetch, issue refused — captured from the live setup.
- [ ] A short evidence note in `docs/work/WI-3/` links the three records to the
      covering FRs.

## Evidence boundary

Proves the live behavior of the new surfaces against fixtures only. Not a client repo
(confidentiality unchanged), not parallelism (out of scope), and the PRs opened are
fixtures-repo PRs for human review like any other — never merged by the harness.

## Status

Ready for planning
