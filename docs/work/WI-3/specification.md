# WI-3 Specification — attachment fetching + non-GitHub issue sources

**Status:** Draft — presented for approval 2026-09-16.

## Source artifacts

- `harness-prd-v2.md` — User Story 1 (L15), User Story 2 (L16), issue ingestion (L35), log
  handling (L37), testing decisions (L90), data handling (L61).
- `docs/work/WI-3/prd.md` — WI-3 carve-out (approved scope table) + grilling decisions
  1–4 (2026-09-16, owner).
- `docs/work/WI-3/slices.md` — slices 1–4 (dependency-ordered, public-seam verification).
- Hard constraints (CLAUDE.md / PRD): confidentiality gate, no auto-merge, local Docker
  only, secrets never echoed — all inherited unchanged; this work item adds one
  mechanical enforcement (FR-002) inside that frame.

## Functional requirements

### FR-001 — Attachment URL discovery

**Behavior.** For every admitted issue, regardless of source, the harness inspects the
issue description for attachment URLs (`github.com/user-attachments/…` links) and
derives the set of attachments to fetch for that issue. Discovery is the same for every
source; only the URL set matters, not where the text came from.

**Source traceability.** PRD User Story 2 (L16); WI-3 prd.md scope table row 1.

**Slice coverage.** Slice 1.

**Success criteria.** Given issue bodies (GitHub, spec-doc, plain-list) containing
user-attachment URLs, inline-log text, both, and neither, discovery returns exactly the
attachment URL set, once per URL, and nothing for bodies without them. *Evidence:
`unit` (vitest at the discovery seam).*

**Boundary and errors.** Zero or multiple URLs in one body are both valid. URLs embedded
in prose or code fences are found. Non-`user-attachments` GitHub URLs are ignored.

**Non-claims.** Does not fetch, parse, or validate URL liveness at discovery time.

### FR-002 — Confidentiality gate on the attachment fetch

**Behavior.** The project profile (`.loop-harness/profile.json`) carries a
`confidentialityCleared` field, settable only by the human at onboarding via the
onboarding entry point's clearance flag. When FR-001 discovers at least one attachment
URL and the profile does not carry `confidentialityCleared: true`, the fetch
**hard-refuses**: the run stops for that issue with a named error identifying the gate
and the action required (clear the repo or drop the attachment). The issue is **not**
silently degraded to body-only — an uncleared repo must never look like a cleared one
whose logs went missing.

**Source traceability.** PRD data handling (L61); hard constraint 3; WI-3 grilling
decision 4.

**Slice coverage.** Slice 1.

**Success criteria.** With `confidentialityCleared` absent/false and an attachment URL
present: the fetch refuses, the error names the gate, and no network request is made.
With the field true (set only via the onboarding flag): the fetch proceeds. The profile
writer records the field only when the flag is passed — onboarding without the flag
never sets it. *Evidence: `unit` (vitest, stubbed HTTP client asserting zero requests on
refusal).*

**Boundary and errors.** Scope is exactly the WI-3 surface: attachment files into
prompts. GitHub-issue bodies and inline logs remain under the existing prose constraint,
unchanged. Already-onboarded repos need a one-line profile touch-up before attachments
fetch for them (accepted consequence, decision 4).

**Non-claims.** Not a general confidentiality mechanism for arbitrary harness surfaces;
not a policy engine.

### FR-003 — Attachment fetch and delivery

**Behavior.** When cleared (FR-002), each attachment URL is fetched with plain
unauthenticated HTTPS, following redirects, never sending an `Authorization` header (or
any credential). The bytes are written into the sandbox filesystem as-is — no
format-specific parsing — and a short excerpt (first/last N lines) is inlined in the
agent prompt, exactly as the inline-log path does today.

**Source traceability.** PRD log handling (L37), User Story 2 (L16); WI-3 grilling
decision 1.

**Slice coverage.** Slice 1.

**Success criteria.** The seeded fixtures attachment (issue #3's uploaded file, verified
present 2026-09-16) fetches and lands in the sandbox; the agent prompt contains the
excerpt; the outbound request carries no Authorization header. *Evidence:
`pipeline-integration` (live flow against fixtures in Docker); no-auth-header asserted
`unit` with a stubbed client.*

**Boundary and errors.** Redirects are followed to any host because no credential exists
to leak. Large/binary/unknown-encoding content is written as-is (opaque blob, L37).
Filenames derive from the URL, not from content sniffing.

**Non-claims.** No format parsing, no summarization, no size cap beyond what the
sandbox filesystem itself imposes. Named revisit trigger (decision 1): an auth-shaped
failure (401/403) on a real repo reopens the fetch-authentication question.

### FR-004 — Loud degradation on fetch failure

**Behavior.** If a discovered, cleared attachment fails to fetch (404, deleted, network
error, timeout), the issue still runs: body text reaches the agent. The failure is
recorded loudly — the run summary and the PR body (when one opens) carry
`attachment fetch failed: <url>`, and the agent prompt states the attachment was
expected but unavailable.

**Source traceability.** WI-3 grilling decision 1; PRD User Story 2 (L16).

**Slice coverage.** Slice 1.

**Success criteria.** With a stubbed client returning 404: the issue is processed, the
summary names the URL, and the prompt text names the missing attachment. *Evidence:
`unit` (stubbed client) + one `pipeline-integration` case where feasible.*

**Boundary and errors.** One URL failing does not block the others in the same issue.
This failure mode is never counted as a fixed issue's verification failure — it is an
input-quality note, not a gate.

**Non-claims.** No retry policy beyond a single fetch attempt; no dead-URL cleanup.

### FR-005 — Spec-doc issue source

**Behavior.** A markdown document is a valid issue source under the authoring contract:
every level-2 (`##`) heading starts one issue; heading text is the title; content until
the next `##` is the description; a `log: <path-or-url>` line inside a section binds
that issue's attachment. Entry id = `spec-<heading-slug>`, counter-suffixed on collision
within the document. A document with zero `##` headings is a loud rejection with a named
error — never a silently empty queue.

**Source traceability.** PRD User Story 1 (L15), ingestion (L33, L35); WI-3 grilling
decisions 2–3.

**Slice coverage.** Slice 2.

**Success criteria.** A spec-doc excerpt with three `##` sections (one carrying a `log:`
line) normalizes to three entries of the internal issue shape `{ id, description,
attachedLog?, sourceType }` — shape-identical to a GitHub issue's normalization (PRD
L90). Slug collision yields `spec-<slug>-2`. Zero-heading input rejects loudly.
*Evidence: `unit` (vitest at the normalizer seam).*

**Boundary and errors.** Retitling a heading creates a new identity (accepted semantics,
decision 2) — the old id's PR dedup no longer matches, which is intended. `#`/`###`
headings are not issue boundaries. The parser rejects, never silently partially ingests.

**Non-claims.** No nested-structure semantics (tables, lists, code fences inside a
section are just description text); no front-matter handling.

### FR-006 — Plain-list issue source

**Behavior.** A plain-text list is a valid issue source: one issue per non-empty line;
`#`-prefixed lines are comments; the line is title and description; an optional
`| <log path-or-url>` suffix binds an attachment. Entry id = `list-<line-slug>`,
counter-suffixed on collision. A list containing only comments/blank lines is a loud
rejection.

**Source traceability.** PRD User Story 1 (L15), L35; WI-3 grilling decisions 2–3.

**Slice coverage.** Slice 3.

**Success criteria.** A list with three issue lines (one with a `| log` suffix) and
comments normalizes to three shape-identical entries (PRD L90). Collision suffixing and
empty-list rejection behave as in FR-005. *Evidence: `unit` (vitest at the normalizer
seam).*

**Boundary and errors.** Same retitle-semantics and loud-rejection rules as FR-005.

**Non-claims.** No quoting/escaping syntax beyond the stated `|` suffix; no multi-line
entries.

### FR-007 — Source parity through the queue

**Behavior.** Whatever the source, normalized entries feed the existing dedup
(`fix/<id>` branch + open-PR token match), cap, and admission stages with **no
source-specific branching downstream** of normalization. Slug ids are consumed exactly
as `gh-N` ids are today. The run summary names the source.

**Source traceability.** PRD ingestion (L35), dedup (L43); WI-3 prd.md scope table rows
2–3; grilling decision 2.

**Slice coverage.** Slices 2–4.

**Success criteria.** A mixed queue (GitHub ids, `spec-*`, `list-*`) dedups correctly:
open-PR token match skips each in-flight id regardless of source; a stale
`fix/spec-<slug>` branch without a PR is deleted and retried. *Evidence: `unit`
(stubbed sources at the acquisition seam).*

**Boundary and errors.** Fix PRs are always GitHub PRs, so open-PR dedup applies to
every source (decision 2). Cap and triage behavior are unchanged.

**Non-claims.** No cross-source id namespacing beyond the `spec-`/`list-` prefixes; no
content-matching dedup (still out of scope).

### FR-008 — Source selection

**Behavior.** The loop entry point accepts the issue source via explicit CLI flags
naming a file: GitHub issues (default, behavior unchanged when no flag is passed), a
spec document, or a plain list. Selecting a file source replaces GitHub acquisition for
that run; it never merges sources in one run.

**Source traceability.** PRD User Story 1 (L15); WI-3 prd.md scope table rows 2–3.

**Slice coverage.** Slice 4.

**Success criteria.** Invoking the entry point with the spec-doc (or plain-list) flag
and a file path produces a queue normalized per FR-005/FR-006 and runs the existing
loop end-to-end: preflight → fix → fresh-sandbox verify → PR on a `fix/spec-*` or
`fix/list-*` branch. Without any flag, acquisition is GitHub-only exactly as today.
*Evidence: `unit` (acquisition seam) + `pipeline-integration` (one non-GitHub source
end-to-end against fixtures in Docker).*

**Boundary and errors.** Unreadable file or unparseable content is a loud failure of
the run before any sandbox work. Exact flag spelling is an implementation detail; the
contract is "explicit, file-naming, default-off."

**Non-claims.** No URL-fetched source documents (the file must exist locally); no
mixing of sources in a single run.

## Non-functional constraints

- No `Authorization` header or credential is ever attached to an attachment fetch
  (FR-003) — mechanically asserted in tests.
- Env values remain never-echoed (prompts, PR bodies, summaries) — inherited, unchanged.
- Local Docker only; no auto-merge; reproduction tests permanent — all inherited
  unchanged.
- Loud over silent: every new failure mode (uncleared gate, unshapable document, failed
  fetch) produces a named error or a recorded degradation, never silent partial
  behavior.
- Implementation-neutral: parsers, gate, and fetch are specified at their public seams
  (normalizer output shape, profile field, entry-point flags), not as named modules.

## Clarifications

None — the four open questions were resolved by the owner in grilling (2026-09-16) and
are recorded in `docs/work/WI-3/prd.md` § Grilling decisions.

## Traceability matrix

| FR | PRD anchor | Grilling decision | Slice | Evidence label |
|---|---|---|---|---|
| FR-001 | US2 (L16) | 1 | 1 | unit |
| FR-002 | L61, constraint 3 | 4 | 1 | unit |
| FR-003 | US2 (L16), L37 | 1 | 1 | pipeline-integration + unit |
| FR-004 | US2 (L16) | 1 | 1 | unit (+ pipeline-integration where feasible) |
| FR-005 | US1 (L15), L33, L35 | 2, 3 | 2 | unit |
| FR-006 | US1 (L15), L35 | 2, 3 | 3 | unit |
| FR-007 | L35, L43 | 2 | 2–4 | unit |
| FR-008 | US1 (L15) | — | 4 | unit + pipeline-integration |

## Approval

- [x] Owner approved this specification (2026-09-17; gate behavior confirmed: uncleared repo + attachment → refuse the issue, per FR-002)
