# Issue Tracker

## Tracker

GitHub Issues on `manjula25/software-factory-loop`.

## Work-item identifier

One issue per work item, titled `[WI-<n>] short title`. The `WI-<n>` prefix is the shared
reference across issues, PRs, and `docs/work/{WORK_ITEM}/` directories. Status lives on the
issue (open/closed); rationale lives in `harness-prd-v2.md` and the work item's specification —
neither restates the other.

## Read procedure

Read the selected issue, comments, attachments, labels, and linked PRs with `gh`. An issue with
an open, unmerged PR referencing it is in progress — do not start duplicate work (the same
dedup rule the harness itself enforces).

## Write procedure

Default to read-only. Prepare proposed mutations (comment, label, close) and execute only with
explicit user authority for the exact change. Commit messages and PR bodies reference the
work item as `WI-<n>` but never use closing keywords against the issue — the human merges and
closes deliberately.
