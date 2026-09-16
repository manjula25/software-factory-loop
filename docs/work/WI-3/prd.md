# WI-3 PRD carve-out — attachment fetching + non-GitHub issue sources

Traceability artifact derived from `harness-prd-v2.md` (PRD) and the WI-2 owner
decisions (`docs/work/WI-2/prd.md` § Out of scope). The PRD wins on any disagreement.
Created 2026-09-16 when WI-3 started (post WI-2 merge, main @ `dd366ae`).

## Why this work item exists

WI-2 shipped queue ingestion for GitHub Issues only, with two deliberate deferrals
named as WI-3 there:

1. **Attachment-URL fetching** — a GitHub issue body may link its log as a
   `github.com/user-attachments/...` URL rather than pasting it. Today the body text
   reaches the agent but the linked file never lands in the sandbox, so the agent
   works without the actual failure evidence PRD User Story 2 promises it.
2. **Spec-doc and plain-list sources** — PRD User Story 1 promises issues from a
   spec/requirements document or a plain list, not just GitHub Issues. The
   normalization seam already anticipates this (`src/issues.ts` carries
   `sourceType: "github-issue" | "spec-doc" | "plain-list"`; only the first has a
   code path). The intended mechanism is the seam Sandcastle anticipated
   (`custom` tracker / `SETUP_ISSUE_TRACKER.md`), extended in place — not a new
   ingestion layer (PRD L33, L35).

## Scope, traced to the PRD

| FR area | PRD anchor | WI-3 delivers |
|---|---|---|
| Attachment fetch | User Story 2 (L16); L37 log handling | Attachment URLs found in an issue body are fetched and written into the sandbox filesystem **as-is** (no format parsing — L37's opaque-blob rule); a short excerpt is inlined in the prompt exactly as for inline logs; every emitted string still passes the confidentiality seam |
| Spec-doc source | User Story 1 (L15); L33; L35 | A spec/requirements document is normalized into the same internal `{ id, description, attachedLog?, sourceType }` shape; dedup/cap/triage consume it identically to GitHub issues |
| Plain-list source | User Story 1 (L15); L35 | Same, for a plain list of issue descriptions (each entry may reference a log file path on disk) |

## Testing decisions inherited (PRD L90)

- Normalization unit test: a GitHub issue, a spec-doc excerpt, and a plain-list entry
  all produce the same internal shape.
- Attachment fetch is a pipeline integration test (actually running the flow) — the
  seeded live case exists: fixtures issue #3's uploaded file
  (`loopfix-issue3-session.log`, verified present 2026-09-16).

## Grilling decisions (2026-09-16, owner)

1. **Attachment fetch: plain unauthenticated HTTPS, degrade loudly.** Verified live:
   the seeded fixtures attachment fetches 302→presigned→200 with no auth. No
   `Authorization` header is ever sent (the redirect crosses hosts; forwarding a
   token there is worse than the problem auth would solve). On fetch failure the
   issue still runs — body text reaches the agent, and the PR body/summary records
   "attachment fetch failed: <url>" with the agent told the attachment was expected
   but unavailable. **Named revisit trigger:** an auth-shaped failure (401/403) on a
   real repo.
2. **Non-GitHub identity: slugs.** Spec-doc entry id = heading slug; plain-list
   entry id = first-line slug; counter-suffix on collision within one source. The
   existing `fix/<id>` branch + PR-body-token dedup consumes these unchanged (fix
   PRs are always GitHub PRs, so open-PR dedup applies to every source). Accepted
   semantics: retitling an entry creates a new identity — a re-scoped issue deserves
   a fresh fix attempt.
3. **Authoring contract, stated (L37's no-assumption rule is about logs; these are
   authored documents).** Spec-doc: markdown, **every** level-2 (`##`) heading
   starts one issue, heading text is the title, content until the next `##` is the
   description; narrative sections just don't use `##`. Plain-list: one issue per
   non-empty line, `#`-prefixed lines are comments, an optional `| <log path-or-url>`
   suffix binds an attachment (spec-docs use a `log: <path-or-url>` line). Both
   parsers reject loudly on input they cannot shape (zero headings, empty list) —
   never silent partial ingestion. Logs themselves remain opaque blobs (L37).
4. **Confidentiality: mechanically gated at the attachment fetch.**
   `.loop-harness/profile.json` gains a `confidentialityCleared` field set only by
   the human at onboarding (`onboard.ts --confidentiality-cleared`); the attachment
   fetch hard-refuses without it. Scope deliberately narrow: the gate covers WI-3's
   new surface (attachment files into prompts); GitHub-issue bodies stay under the
   prose constraint as today. Consequence accepted: already-onboarded repos need a
   one-line profile touch-up before attachments fetch for them.

## Out of scope (still)

Parallelism, dependency-aware grouping, cost accounting, content-matching dedup —
unchanged from the WI-2 deferrals and PRD Out of Scope.
