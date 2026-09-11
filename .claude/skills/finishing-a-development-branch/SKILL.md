---
name: finishing-a-development-branch
description: Prepare a verified and reviewed branch for an explicitly authorized delivery action without silently mutating external systems.
disable-model-invocation: true
---

# Finishing a Development Branch

## Required inputs

Clean intended repository status, fresh verification, resolved blocking review findings, and accurate branch, base, and commit-range metadata.

## Optional inputs

Requested delivery channel, tracker context, release notes, deployment constraints, and explicit external-action authority.

## Project context — what "delivery" means here

Delivery is a **pull request** — nothing else. The harness under development never merges its
own PRs, and neither does an agent working in this repo: pushing a branch and opening a PR is
the delivery action; merging belongs to a human reviewer (see the hard constraints in
`CLAUDE.md`). There is no deployment in this POC — no CI pipeline, no cloud; the pipeline runs
on local Docker only. Never run repo-wide git from `/Users/manju` — scope to this folder
(repo-boundary caveat).

## Required companion skills

None.

## Output

`docs/work/{WORK_ITEM}/delivery.md` rendered from [the delivery template](delivery-template.md), plus prepared commands or content for only the requested actions.

## Process

1. Verify the current repository, intended branch, configured base, clean or intentionally documented status, and exact non-empty commit range.
2. Read fresh verification and review records. Require every blocking finding to be resolved against the current candidate.
3. Produce an honest delivery summary: scope, artifacts, evidence boundary, non-claims, remaining risks, branch/base, commit range, and review status.
4. Ask which external actions are requested and confirm exact scope. Preparing an action is not authority to execute it.
5. Prepare commands or content. Perform a push, pull request, merge, tracker transition, deployment, or publication only when the user explicitly requests that exact action.
6. Record what was prepared, what was executed with authority, observed results, and what remains pending. Never claim an external action occurred from a prepared command.

## Completion criterion

The intended status and metadata are accurate, verification is fresh, blocking findings are resolved, `delivery.md` is honest, and every performed external action has explicit authority and observed evidence.

## Stop conditions

Stop when status is unexpectedly dirty, verification is stale or failing, review blockers remain, branch/base metadata is uncertain, commit range is empty, or external-action approval is absent.

## Next recommended skill

None. Return the delivery summary and pending options to the user.
