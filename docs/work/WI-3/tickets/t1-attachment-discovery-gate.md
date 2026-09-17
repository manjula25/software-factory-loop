# T1 — Attachment discovery + confidentiality gate

## What to build

For every admitted issue regardless of source, the harness inspects the issue
description for `github.com/user-attachments/…` links and derives the set of
attachments to fetch — once per URL, from any source's body text, ignoring
non-attachment GitHub URLs. The project profile (`.loop-harness/profile.json`) gains a
`confidentialityCleared` field, settable only by the human at onboarding via a
`--confidentiality-cleared` flag on the onboarding entry point (absent flag → field
never written). When discovery finds at least one attachment URL and the profile does
not carry `confidentialityCleared: true`, the fetch **hard-refuses** before any network
request: the issue stops with a named error identifying the gate and the action
required (clear the repo or drop the attachment). The issue is never silently degraded
to body-only at this stage.

## Blocked by

None — can start immediately.

## Requirement coverage

FR-001, FR-002; slice 1; grilling decision 4; PRD US2 (L16), L61, hard constraint 3.

## Acceptance criteria

- [ ] Vitest cases at the discovery seam with bodies containing: one attachment URL,
      multiple URLs (incl. duplicate), URL embedded in prose and in a code fence,
      inline-log text, non-attachment GitHub URLs, and neither — discovery returns
      exactly the deduplicated URL set, and nothing for attachment-free bodies.
- [ ] Same cases run through bodies sourced as GitHub issue, spec-doc, and plain-list
      text — discovery output identical regardless of source.
- [ ] Vitest case with a stubbed HTTP client: uncleared profile + attachment URL →
      named gate error naming the repo and the two resolutions; **zero** requests made.
- [ ] Vitest case: cleared profile → fetch step is reached (request initiated).
- [ ] Onboarding profile-writer tests: `--confidentiality-cleared` present → field
      written true; flag absent → field absent/false — never inferred from anything else.
- [ ] Existing suite stays green (`npm test`, `npm run typecheck`).

## Evidence boundary

Proves discovery and the gate against stubbed clients and fixture bodies. Does not
prove a live fetch (T2's stub; T6's live run), does not deliver bytes into a sandbox
(T2), and does not cover inline logs (existing behavior, untouched).

## Status

Ready for planning
