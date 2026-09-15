# Slices — WI-2: Queue ingestion

Five slices, ordered by dependency. Each is independently verifiable at a public seam
(harness source via vitest, or pipeline integration against the fixtures repo in Docker).

## Slice 1 — Queue acquisition

`gh issue list` on the target repo (optional `--label` filter; one page at the default
limit) → every open issue normalized through the existing normalizer into
`{ id, description, attachedLog?, sourceType }`. Empty queue and `gh` failure are distinct,
named outcomes. Unit-tested at the normalizer/fetch seam with a stubbed `gh`; the fix step
sees a list of the same shape WI-1 already consumes.

## Slice 2 — Dedup + stale-branch handling

Given the normalized queue, mark an issue *skipped-duplicate* when an **open PR**'s head
branch is `fix/<id>` or its body references the issue by exact id token (no substring
matches — `gh-1` must not match `gh-11`). A `fix/<id>` branch that exists *without* an
open PR is a stale attempt: delete it and keep the issue eligible for retry. Skipped
issues cost no sandbox, no agent run, no API spend. Unit-tested with a stubbed branch/PR
listing including the substring false-positive and stale-branch cases.

## Slice 3 — Cap + optional triage

If the deduped queue exceeds the cap, admit the first `cap` issues in **deterministic
order** (ascending issue number) — no model call, Sandcastle-style cheap by default. When
the optional `--triage` flag is set and the queue exceeds the cap, a short-prompt scoring
pass through the run's resolved provider returns, per issue, a priority score **and the
files the issue likely touches** (decisions 14–15); the output is validated with a Zod
schema (`{ scores, files }` — Sandcastle's `Output.object` pattern). Admission walks the
ranked list (score desc, ties by ascending issue number) and **defers** an issue whose
file set overlaps an already-admitted issue's — reported as not-admitted with the overlap
reason, the sequential-execution translation of Sandcastle's dependency graph. If the
queue is at or under the cap, triage never runs even with the flag (nothing to choose).
Output that fails Zod validation degrades to the deterministic order with a loud warning,
never a silent or arbitrary admission. Cap is a CLI flag (`--max-issues`, validated ≥ 1,
POC default 3) and applies to queue mode only — an explicit `--issue N` override skips cap
and triage. Unit-tested: over-cap without `--triage` → deterministic admission, no scoring
call; over-cap with `--triage` → scoring invoked, exactly `cap` admitted, order respects
scores, overlapping issues deferred with reason; under-cap → triage not invoked;
schema-invalid output → fallback order plus warning.

## Slice 4 — Sequential multi-issue run

Process the admitted queue one issue at a time through the existing per-issue loop
(preflight, fix, verification, PR). An individual failure records that issue as failed
(with the WI-1 branch-cleanup behavior) and processing continues with the next issue; a
failure never aborts the queue. Unit-tested at the LoopDeps seam with a queue of stubbed
issues mixing successes and failures.

## Slice 5 — Run summary

At end of run, print one summary: issues attempted, fixed, failed, skipped-duplicate,
not-admitted (with the reason named — the cap, or a file-overlap deferral), and a link to
every PR opened this run. Derivable entirely from per-issue outcomes — no new state.
Unit-tested alongside slice 4;
pipeline-integration runs against the fixtures repo exercise the whole chain (slice 1→5),
including at least one cap-forcing run (`--max-issues` smaller than the deduped queue) so
triage and admission are proven live, not only under stubs.
