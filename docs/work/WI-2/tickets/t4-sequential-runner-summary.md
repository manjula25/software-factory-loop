# T4 — Sequential runner and run summary

## What to build

Widen the CLI: queue mode is the default when `--issue` is absent; `--issue N` remains an
explicit single-issue override that skips cap and triage while dedup still applies. Admitted
issues are processed one at a time, in admission order, each through the existing per-issue
path (baseline preflight, fix sandbox, fresh-sandbox verification, PR). An issue-level
failure records the failure, runs WI-1 branch cleanup, and continues with the next issue; a
harness-level failure (missing credentials, stale baseline profile) aborts the queue. When
the queue is exhausted, print one summary: issues attempted, fixed, failed,
skipped-duplicate, not-admitted (each with its reason — the cap, or a T3 file-overlap
deferral), and the URL of every PR opened this run. A run that aborts at startup prints
its abort reason, not a summary.

## Blocked by

T3 — consumes the admitted, ordered queue.

## Requirement coverage

Slices 4 and 5 (folded by owner decision); FR-004, FR-005; grilling decisions 2
(sequential), 6 (`--issue N` override semantics), 3/11 (no new state — summary derives
from per-issue outcomes only).

## Acceptance criteria

- [ ] Vitest case at the injected-deps seam driving a three-issue queue where the second
      fails verification: issues 1 and 3 complete their full per-issue path, issue 2's fix
      branch is deleted, exactly two PRs are opened.
- [ ] Sequential ordering asserted: only one fix sandbox exists at a time (sandbox
      creation/completion interleaving checked on the recorder).
- [ ] Harness-level failure (e.g. stale baseline preflight) aborts the queue with a named
      error; no further issues are attempted.
- [ ] Summary counts match the stubbed mixed outcomes; every opened-PR URL appears;
      each not-admitted entry names its reason (cap or file-overlap deferral).
- [ ] `--issue N` override processes exactly that issue: no cap, no triage, dedup applied
      (open PR on it → skipped).
- [ ] Summary text passes the secrets guard; no new persistent state is written.
- [ ] Existing suite stays green (`npm test`, `npm run typecheck`).

## Evidence boundary

Proves queue orchestration, failure taxonomy, and summary correctness under stubs.
Real-fixture behavior — live acquisition, live dedup against actual PRs, real agent runs —
is T5's boundary. Merge-time conflicts between sequential fixes touching the same module
are accepted by decision and not detected here.

## Status

Ready for planning
