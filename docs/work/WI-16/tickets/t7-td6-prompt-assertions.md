# T7 — TD6: narrow the prompt-text assertions to the interface

## What to build

The suite's assertions on the text of the fix prompt are reduced to the **interface** between the
harness and the agent, and the assertion that pins prose is removed.

The rule this ticket applies, stated in FR-012 and made explicitly there because the grilling record
required the call be made rather than left implied: an assertion on the prompt is legitimate exactly
when it pins a token the harness **depends on at a seam of its own** — produced by the harness and
consumed by it, or produced by the agent under a contract the harness then parses back. It is
illegitimate when it pins the **phrasing** of an instruction the model is asked to read.

Concretely, in `src/loop.test.ts:326–353`:

**Kept** — each is a token the harness constructs or parses:

- `ello-world` (the symptom, carried from the issue)
- `pip install -e ".[test]"` and `pytest -q` (commands the harness pinned in the profile)
- `reproTestPath(issue)` (a path the harness constructs and later reads back)
- `LOOP_IDENTITY.name` / `.email` (the commit identity the harness set)
- `<red-evidence>` / `<green-evidence>` (wrapper tags the harness parses back out)
- `` `.loop-harness/` `` (a directory the harness owns and stages attachments into)

**Removed** — `expect(prompt).toMatch(/commit only the fix and the reproduction test/i)` — an
ordinary-language regular expression over a sentence the model is asked to read.

Test-only. **No production source changes**: `buildFixPrompt` is not modified, only what the suite
asserts about it.

## Blocked by

None — can start immediately.

## Requirement coverage

FR-012; slice E.

## Acceptance criteria

- [ ] No assertion on the prompt matches prose with an ordinary-language regular expression
      (`review` of the diff, with each remaining assertion classified as interface or phrasing)
- [ ] Every retained assertion names a token the harness produces or parses, and the classification
      is stated in the ticket's implementation notes (`review`)
- [ ] The behavior the removed assertion stood for — that the fix branch carries only the fix and
      the reproduction test — is asserted **where that behavior lives**, or the gap is recorded as a
      finding rather than dropped silently (`review`, plus a failing-then-passing check if one is
      added)
- [ ] `npm test` and `npm run typecheck` are green (`unit`)

## Evidence boundary

Proves the prompt assertions pin interfaces rather than wording, and that removing the prose
assertion cost no behavioral coverage — or names exactly where it did. Does not claim the remaining
assertions are behavioral tests: they are interface pins, and FR-012 says so rather than pretending
otherwise. Does not touch any production source.

## Status

Ready for planning