---
name: to-tickets
description: Convert an approved work item (or its specification or plan) into dependency-aware local tickets and explicitly authorized tracker items.
disable-model-invocation: true
---

# To Tickets

## Required inputs

An approved work item (or the `docs/work/{WORK_ITEM}/specification.md` or implementation plan
derived from it), `harness-prd-v2.md` for goal context, and the tracker policy in
`docs/agents/issue-tracker.md`. There is no build plan yet — the work item's approved
specification is the decomposition source of record.

## Optional inputs

Domain glossary (`CONTEXT.md`), Architecture Decision Records, triage labels, and tracker capabilities.

## Project context — GitHub Issues is the tracker

GitHub Issues on `manjula25/software-factory-loop` hold **one issue per work item**
(`[WI-<n>] short title`), per `docs/agents/issue-tracker.md`. The ticket layer's job is
**dependency edges and FR traceability** — `Blocked by` ordering across tickets and within a
work item, plus which `FR-###` each piece delivers. A ticket that only restates a specification
line duplicates it and is deleted in review. Status lives on the GitHub Issue; a ticket
completing means checking off its checklist item, not opening a second tracker item. Tracker
writes are read-only by default — prepare proposed mutations, execute only with explicit user
authority.

## Required companion skills

None.

## Output

One Markdown file per approved ticket under `docs/work/{WORK_ITEM}/tickets/`, rendered from [the ticket template](ticket-template.md). External tracker issues are optional mirrors created only after explicit user approval.

## Process

1. Convert approved work into narrow, vertical, independently verifiable tickets. Preserve requirement traceability and avoid horizontal layer-only work.
2. Record **Blocked by** edges and order tickets by their dependency frontier. A ticket with no blockers can start immediately.
3. Keep each ticket within one bounded implementation context and give it observable acceptance criteria and an evidence boundary.
4. Use expand, migrate, and contract tickets for a wide refactor that cannot remain green as one vertical change.
5. Present the complete ticket graph and obtain user approval before writing local files.
6. Write local ticket artifacts first. Do not publish, modify, close, label, or link anything on an external tracker without explicit user approval for that action and target.
7. When external publication is approved, verify the configured external tracker, create blockers before dependents, use native blocking links when available, and read back every created issue.

## Completion criterion

The user approves a dependency-aware ticket set whose local artifacts are complete, and any explicitly authorized external tracker writes have been read back and verified.

## Stop conditions

Stop when the work item has no approved specification (or its upstream artifact is unapproved), tracker configuration is missing where a tracker write was requested, ticket boundaries are not vertical, dependency edges remain disputed, or external tracker authority is absent.

## Next recommended skill

Recommend `writing-plans` for the first ready ticket or `implement` when an approved executable plan already exists.
