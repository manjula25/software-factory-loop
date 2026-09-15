# T3 — Cap with deterministic default and opt-in triage

## What to build

Queue runs admit at most `cap` issues: `--max-issues` CLI flag, validated ≥ 1 at startup,
POC default 3. Default admission order is deterministic — first `cap` issues in ascending
issue-number order, no model call, no file knowledge. An optional `--triage` flag enables
AI ranking: when set and the deduped queue exceeds the cap, a short-prompt scoring pass
through the run's resolved provider and model returns, per issue, a priority score **and
the files the issue likely touches**, as one JSON block validated with a Zod schema
(`{ scores: Record<id, 1–5>, files: Record<id, string[]> }` — Sandcastle's
`Output.object` pattern; Zod becomes a direct dependency). Admission walks the ranked list
(score desc, ties by ascending issue number) and defers an issue whose reported files
overlap an already-admitted issue's files — it is reported as not-admitted naming the
overlap and never reaches a sandbox (decision 14). Output that fails Zod validation
degrades to the deterministic order with a loud warning naming the fallback. Issues beyond
the cap are reported as not-admitted with the cap named.

## Blocked by

T2 — admission operates on the deduped queue.

## Requirement coverage

Slice 3; FR-003; grilling decisions 3 (same model, short prompt), 7 (degrade not abort),
9 (deterministic default, `--triage` opt-in); comparison-review decisions 14
(dependency-aware deferral under `--triage`) and 15 (Zod-validated triage output);
PRD grilling 2026-09-15 item 1 (amended same day).

## Acceptance criteria

- [ ] Over-cap queue without `--triage`: exactly `cap` issues admitted in ascending-number
      order, scoring call never invoked.
- [ ] Over-cap queue with `--triage`: scoring invoked, exactly `cap` admitted, order
      respects returned scores; equal scores ordered by ascending issue number.
- [ ] Under-cap queue: everything admitted, triage not invoked even with the flag set.
- [ ] Nothing beyond the cap reaches sandbox creation.
- [ ] Schema-invalid triage output (malformed JSON, out-of-range scores, mismatched tags):
      deterministic admission proceeds with a loud warning; run does not abort.
- [ ] Under `--triage`, an issue whose reported files overlap an already-admitted issue's
      is deferred — reported not-admitted naming the overlap, never reaching sandbox
      creation — while a non-overlapping issue is admitted in its ranked position.
- [ ] `--max-issues 0` (or negative) is a startup configuration error.
- [ ] Triage prompt and parsed output pass the secrets guard; scoring input is bounded by
      the T1 one-page acquisition limit.
- [ ] Existing suite stays green (`npm test`, `npm run typecheck`).

## Evidence boundary

Proves admission logic, overlap deferral, and triage degradation under unit stubs. Live
scoring behavior (model actually returns schema-valid scores and file lists through the
proxy) is proven in T5, not here.

## Status

Ready for planning
