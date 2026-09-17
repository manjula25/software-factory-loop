# Slices — WI-3: Attachment fetching + non-GitHub issue sources

Four slices, ordered by dependency. Each is independently verifiable at a public seam
(harness source via vitest, or pipeline integration against the fixtures repo in Docker).
Scope source: `prd.md` (carve-out + grilling decisions 2026-09-16).

## Slice 1 — Attachment discovery, gate, and fetch

For every admitted issue regardless of source, find `github.com/user-attachments/…`
links in the issue body. If any are found and the target's project profile does not
carry `confidentialityCleared: true`, the fetch hard-refuses with an error naming the
gate (the issue is **not** silently degraded — an uncleared repo must never be mistaken
for a cleared one with missing logs; the operator must clear it or drop the attachment).
When cleared: fetch each link with plain HTTPS following redirects, **never sending an
Authorization header**; write the bytes into the sandbox as an opaque file (L37); inline
the same short excerpt the inline-log path uses. On fetch failure (404, deleted, network):
the issue still runs, degraded loudly — the run summary and PR body record
"attachment fetch failed: \<url\>" and the agent prompt says the attachment was expected
but unavailable. The profile field is settable only by the human at onboarding
(`--confidentiality-cleared` on the onboarding entry point). Unit-tested at the
discovery/gate/fetch seam with a stubbed HTTP client (gate refusal, cleared fetch,
failure-degrade, no-auth-header assertion); pipeline-integration against the seeded
fixtures attachment (issue #3, verified present 2026-09-16).

## Slice 2 — Spec-doc source

A markdown document is a valid issue source under the stated contract: every level-2
(`##`) heading starts one issue, heading text is the title, content until the next `##`
is the description, a `log: <path-or-url>` line inside a section binds its attachment.
Entry id = heading slug (`spec-<slug>`), counter-suffixed on collision within the
document. Zero level-2 headings is a loud rejection (named error), never an empty queue.
Unit-tested at the normalizer seam: shape equality with a GitHub issue (PRD L90), slug
identity and collision, zero-heading rejection, `log:` binding.

## Slice 3 — Plain-list source

A plain-text list is a valid issue source: one issue per non-empty line, `#`-prefixed
lines are comments, the line is title+description, an optional `| <log path-or-url>`
suffix binds an attachment. Entry id = first-line slug (`list-<slug>`), counter-suffixed
on collision. An empty list (only comments/blank lines) is a loud rejection. Unit-tested
at the normalizer seam: shape equality (PRD L90), slug identity, empty rejection,
suffix binding.

## Slice 4 — Source selection + queue wiring

The loop entry point accepts the source: GitHub (default, unchanged), a spec document,
or a plain list — as explicit CLI flags naming the file. Whatever the source, the
normalized queue feeds the **unchanged** dedup (`fix/<id>` + PR-body token), cap, and
admission stages; slug ids flow through with no source-specific branching downstream.
The run summary names the source. Unit-tested at the acquisition seam with stubbed
sources (mixed `gh-N` / `spec-*` / `list-*` queue dedups correctly); a
pipeline-integration run drives one non-GitHub source end-to-end against fixtures
(preflight → fix → verify → PR with a `fix/spec-*` or `fix/list-*` branch).
