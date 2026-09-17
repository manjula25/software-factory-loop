# T2 — Attachment fetch, delivery, loud degrade

## What to build

When T1's gate clears, each attachment URL is fetched with plain unauthenticated HTTPS,
following redirects, never sending an `Authorization` header or any credential. The
bytes are written into the sandbox filesystem as-is (opaque blob, filename derived from
the URL, no content sniffing or parsing), and a short excerpt (first/last N lines) is
inlined in the agent prompt exactly as the inline-log path does today. On fetch failure
(404, deleted, network error, timeout) the issue still runs: the failure is recorded
loudly — the run summary and PR body (when one opens) carry
`attachment fetch failed: <url>`, and the agent prompt states the attachment was
expected but unavailable. One URL failing never blocks the others in the same issue.

## Blocked by

T1 — the gate must exist and refuse before fetch mechanics mean anything.

## Requirement coverage

FR-003, FR-004; slice 1; grilling decision 1; PRD US2 (L16), L37.

## Acceptance criteria

- [ ] Vitest with a stubbed HTTP client: cleared fetch writes the response bytes
      verbatim into the sandbox filesystem (binary-safe), filename derived from the URL.
- [ ] The outbound request carries no `Authorization` header — asserted on the stubbed
      client across the initial request and every redirect hop.
- [ ] Agent prompt contains the same excerpt shape the inline-log path produces
      (first/last N lines of the fetched content).
- [ ] Vitest: stubbed 404 → the issue still processes, the run summary names the exact
      URL with `attachment fetch failed:`, and the prompt states the attachment was
      expected but unavailable.
- [ ] Vitest: one URL of two failing → the other still fetches and delivers.
- [ ] Existing suite stays green (`npm test`, `npm run typecheck`).

## Evidence boundary

Proves fetch/delivery/degrade against a stubbed HTTP client. Does not prove the live
GitHub attachment redirect chain (T6's pipeline-integration run), and does not change
inline-log handling (untouched, shared excerpt path only).

## Status

Ready for planning
