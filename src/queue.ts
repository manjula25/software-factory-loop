/**
 * Queue ingestion (WI-2): acquiring the target repo's open issues and
 * normalizing them through the WI-1 normalizer. Acquisition is one page at
 * a bounded limit — the page is also the ceiling on downstream triage spend.
 */

import { execFileSync } from "node:child_process";
import { normalizeGitHubIssue, type GitHubIssueInput, type NormalizedIssue } from "./issues.js";

export interface QueueDeps {
  /** Runs `gh` with JSON output; throws on a non-zero exit. */
  ghJson(args: string[], cwd: string): string;
}

/** Named outcome for a failed queue-listing call — distinct from an empty queue. */
export class QueueAcquisitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueAcquisitionError";
  }
}

export interface ListIssuesInput {
  readonly repo: string;
  readonly label?: string;
}

/** The one-page bound: acquisition never pages past this many issues. */
const ISSUE_PAGE_LIMIT = 30;

export async function listOpenIssues(
  deps: QueueDeps,
  input: ListIssuesInput,
): Promise<NormalizedIssue[]> {
  const args = [
    "issue",
    "list",
    "--repo",
    input.repo,
    "--state",
    "open",
    "--limit",
    String(ISSUE_PAGE_LIMIT),
    "--json",
    "number,title,body,url",
  ];
  if (input.label !== undefined) {
    args.push("--label", input.label);
  }

  let raw: string;
  try {
    raw = deps.ghJson(args, process.cwd());
  } catch (error) {
    throw new QueueAcquisitionError(
      `gh issue list failed for ${input.repo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new QueueAcquisitionError(`gh issue list returned unparseable JSON for ${input.repo}`);
  }
  if (!Array.isArray(parsed)) {
    throw new QueueAcquisitionError(`gh issue list returned a non-array payload for ${input.repo}`);
  }

  return (parsed as GitHubIssueInput[]).map(normalizeGitHubIssue);
}

/** Real `gh` wiring used by the CLI; tests inject their own `ghJson`. */
export function realGhJson(args: string[], cwd: string): string {
  return execFileSync("gh", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
