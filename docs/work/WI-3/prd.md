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

## Open questions for grilling (not answered here)

1. **Attachment auth**: `user-attachments` URLs are plain HTTPS; do any reachable
   cases (private repos) require authenticated fetch, and if so via `gh api` or the
   token? A wrong guess leaks either capability or nothing.
2. **Dedup identity for non-GitHub sources**: `fix/gh-N` branch identity and
   open-PR dedup are GitHub-shaped. What is the stable identity of a spec-doc entry
   (section number? heading slug?) and does open-PR dedup apply to it at all?
3. **Spec-doc format assumption**: how much structure may the parser assume before
   it violates "no format assumption" (L37 applies to logs; specs are authored
   documents, maybe markdown headings are fair game)?
4. **Confidentiality**: attachment files are client data (constraint 3). Fetching
   them into sandbox prompts is exactly the flow the gate governs — magvation and
   CareSync are cleared; fixtures is our own repo. No new client repo rides along.

## Out of scope (still)

Parallelism, dependency-aware grouping, cost accounting, content-matching dedup —
unchanged from the WI-2 deferrals and PRD Out of Scope.
