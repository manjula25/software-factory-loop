/**
 * Queue ingestion (WI-2): acquiring the target repo's open issues and
 * normalizing them through the WI-1 normalizer. Acquisition is one page at
 * a bounded limit — the page is also the ceiling on downstream triage spend.
 */

import { execFileSync } from "node:child_process";
import { normalizeGitHubIssue, type GitHubIssueInput, type NormalizedIssue } from "./issues.js";
import { fixBranch } from "./loop.js";
import type { LoopDeps } from "./loop.js";

export interface OpenPr {
  readonly headRefName: string;
  readonly body: string;
}

export interface QueueDeps {
  /** Runs `gh` with JSON output; throws on a non-zero exit. */
  ghJson(args: string[], cwd: string): string;
  listOpenPrs(repoDir: string): Promise<OpenPr[]>;
  /** Local and remote `fix/*` branch names that exist right now. */
  listFixBranches(repoDir: string): Promise<string[]>;
  /** `git push origin --delete`; resolves even if the branch is absent. */
  deleteRemoteBranch(repoDir: string, branch: string): Promise<void>;
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

export interface SplitResult {
  /** Deduped queue: in-order issues eligible for admission and retry. */
  readonly eligible: NormalizedIssue[];
  /** Ids of issues an open PR already covers — skipped, costing nothing. */
  readonly skippedDuplicate: string[];
  /** Stale `fix/<id>` branches deleted (no open PR owns them). */
  readonly staleBranchesDeleted: string[];
}

/**
 * Splits the normalized queue into eligible / skipped-duplicate, deleting
 * stale `fix/<id>` branches along the way. An issue is in flight when an
 * open PR's head branch is its fix branch or its body references the issue
 * by exact id token (`gh-1` never matches `gh-11`). Local stale-branch
 * deletion reuses the WI-1 `LoopDeps.deleteBranch` seam.
 */
export async function splitQueue(
  deps: QueueDeps & Pick<LoopDeps, "deleteBranch">,
  repoDir: string,
  issues: readonly NormalizedIssue[],
): Promise<SplitResult> {
  let prs: OpenPr[];
  let branches: string[];
  try {
    prs = await deps.listOpenPrs(repoDir);
    branches = await deps.listFixBranches(repoDir);
  } catch (error) {
    throw new QueueAcquisitionError(
      `listing open PRs / fix branches failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const eligible: NormalizedIssue[] = [];
  const skippedDuplicate: string[] = [];
  const staleBranchesDeleted: string[] = [];

  for (const issue of issues) {
    const branch = fixBranch(issue);
    const token = new RegExp(`\\b${issue.id.replace(/[-]/g, "\\-")}\\b`);
    const inFlight = prs.some(
      (pr) => pr.headRefName === branch || token.test(pr.body),
    );
    if (inFlight) {
      skippedDuplicate.push(issue.id);
      continue;
    }
    if (branches.includes(branch)) {
      await deps.deleteBranch(repoDir, branch);
      await deps.deleteRemoteBranch(repoDir, branch);
      staleBranchesDeleted.push(branch);
    }
    eligible.push(issue);
  }

  return { eligible, skippedDuplicate, staleBranchesDeleted };
}
