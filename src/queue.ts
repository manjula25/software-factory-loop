/**
 * Queue ingestion (WI-2): acquiring the target repo's open issues and
 * normalizing them through the WI-1 normalizer. Acquisition is one page at
 * a bounded limit — the page is also the ceiling on downstream triage spend.
 */

import { execFileSync } from "node:child_process";
import { z } from "zod";
import { normalizeGitHubIssue, type GitHubIssueInput, type NormalizedIssue } from "./issues.js";
import { fixBranch } from "./loop.js";
import type { LoopDeps } from "./loop.js";

export interface OpenPr {
  readonly headRefName: string;
  readonly body: string;
}

/**
 * A merged fix PR (WI-6 FR-002). Carries `number`/`url` so later tasks
 * (the revert net) can identify it; dedup itself only reads the
 * `OpenPr` fields.
 */
export interface MergedPr extends OpenPr {
  readonly number: number;
  readonly url: string;
}

export interface QueueDeps {
  /** Runs `gh` with JSON output; throws on a non-zero exit. */
  ghJson(args: string[], cwd: string): string;
  listOpenPrs(repoDir: string): Promise<OpenPr[]>;
  /**
   * Merged PRs — a merged fix means the issue is done (WI-6 FR-002), UNLESS
   * main has since reverted that PR (WI-6 T4, FR-006: a reverted merged PR
   * restores its issue to todo). Consulted only for the covering PR.
   */
  listMergedPrs(repoDir: string): Promise<MergedPr[]>;
  /**
   * WI-6 (D4, FR-006): true when main's history contains a `Revert "…"`
   * commit naming this PR (`(#<number>)`) — the merge is undone on main and
   * the issue must NOT be skipped as merged.
   */
  mainRevertsPr(input: { repoDir: string; pr: MergedPr }): Promise<boolean>;
  /**
   * WI-7 (FR-001): `git fetch --prune origin` in the target clone, awaited
   * before any dedup signal is read. Every signal the split consults —
   * merged PRs, the revert guard's `origin/main` history, fix branches —
   * describes the REMOTE's now; a stale clone would read a revert that has
   * since landed as absent and skip a live issue as already merged.
   */
  refreshRemoteRefs(repoDir: string): Promise<void>;
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
export const ISSUE_PAGE_LIMIT = 30;

/**
 * The dedup signal's own page bound. `gh pr list` silently defaults to 30: on a
 * repo with more PRs than that, a fix already in flight (open) or already done
 * (merged) on page 2 reads as absent, so the issue is re-run and a competing PR
 * opened. The bound is explicit here, shared by both listings, and never
 * narrower than the queue it filters.
 */
export const PR_PAGE_LIMIT = 100;

/**
 * Args for a dedup PR listing — exported so the bound above is testable.
 * `open` keeps exactly the historical fields; `merged` adds `number,url`
 * (the revert net's identifiers) to the same shape.
 */
export function prListArgs(state: "open" | "merged"): string[] {
  return [
    "pr",
    "list",
    "--state",
    state,
    "--limit",
    String(PR_PAGE_LIMIT),
    "--json",
    state === "open" ? "headRefName,body" : "headRefName,body,number,url",
  ];
}

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
  /** Ids of issues a MERGED PR already fixed — done, never re-admitted (WI-6). */
  readonly skippedMerged: string[];
  /** Stale `fix/<id>` branches deleted (no open or merged PR owns them). */
  readonly staleBranchesDeleted: string[];
}

/**
 * Escape every RegExp metacharacter. Ids are `gh-N` today, but the PRD keeps
 * spec-document and plain-list sources in scope, and an id carrying a `.` or
 * `(` would otherwise match the wrong PR body or throw at construction.
 */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

/**
 * Whether `pr` covers the issue under dedup: its head branch IS the issue's
 * fix branch, or its body references the issue by exact id token
 * (`gh-1` never matches `gh-11`) — the same rule for open and merged PRs.
 */
function covers(pr: OpenPr, branch: string, token: RegExp): boolean {
  return pr.headRefName === branch || token.test(pr.body);
}

/**
 * Splits the normalized queue into eligible / skipped-duplicate /
 * skipped-merged, deleting stale `fix/<id>` branches along the way. A MERGED
 * fix PR means the issue is done: matched by head branch or body id token
 * under the same exact-token, case-insensitive rule as open PRs, checked
 * BEFORE the open-PR check and before any branch deletion — a merged PR's
 * branch is never delete-and-retried (WI-6 FR-002) — UNLESS main has since
 * reverted that PR (`mainRevertsPr`, WI-6 T4 FR-006): a reverted merged PR
 * restores its issue to todo. The revert check is consulted only for the PR
 * that actually covers the issue, never per-PR over the whole list. An issue
 * is in flight when an open PR's head branch is its fix branch or its body
 * references the issue by exact id token (`gh-1` never matches `gh-11`).
 * Local stale-branch deletion reuses the WI-1 `LoopDeps.deleteBranch` seam.
 */
export async function splitQueue(
  deps: QueueDeps & Pick<LoopDeps, "deleteBranch">,
  repoDir: string,
  issues: readonly NormalizedIssue[],
): Promise<SplitResult> {
  let prs: OpenPr[];
  let mergedPrs: MergedPr[];
  let branches: string[];
  try {
    // Refresh FIRST (WI-7 FR-001): every signal below reads the remote's now
    // through the clone's remote-tracking refs — a stale clone would read a
    // revert that has since landed as absent and skip a live issue as merged.
    await deps.refreshRemoteRefs(repoDir);
    mergedPrs = await deps.listMergedPrs(repoDir);
    prs = await deps.listOpenPrs(repoDir);
    branches = await deps.listFixBranches(repoDir);
  } catch (error) {
    throw new QueueAcquisitionError(
      `acquiring queue state failed (refreshing remote refs / listing PRs / fix branches): ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const eligible: NormalizedIssue[] = [];
  const skippedDuplicate: string[] = [];
  const skippedMerged: string[] = [];
  const staleBranchesDeleted: string[] = [];

  for (const issue of issues) {
    const branch = fixBranch(issue);
    // Case-insensitive: a human PR body writes "Fixes GH-1" as often as "gh-1",
    // and skipping an issue costs nothing — it reappears in the next queue.
    const token = new RegExp(`\\b${escapeRegExp(issue.id)}\\b`, "i");
    // Merged first: a merged fix is stronger than an in-flight one (a reopened
    // PR keeps its head branch), and its branch must never reach deletion —
    // unless main reverted it (WI-6 T4, FR-006): the issue goes back to todo.
    const mergedCover = mergedPrs.find((pr) => covers(pr, branch, token));
    const done =
      mergedCover !== undefined &&
      !(await deps.mainRevertsPr({ repoDir, pr: mergedCover }));
    if (done) {
      skippedMerged.push(issue.id);
      continue;
    }
    const inFlight = prs.some((pr) => covers(pr, branch, token));
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

  return { eligible, skippedDuplicate, skippedMerged, staleBranchesDeleted };
}

// ---------------------------------------------------------------------------
// Admission: cap with deterministic default, opt-in triage (FR-003).
// ---------------------------------------------------------------------------

/** Zod-validated triage output — Sandcastle's `Output.object` pattern (decision 15). */
export interface TriageValue {
  readonly scores: Readonly<Record<string, number>>;
  readonly files: Readonly<Record<string, readonly string[]>>;
}

const TriageOutput = z.object({
  scores: z.record(z.string(), z.number().int().min(1).max(5)),
  files: z.record(z.string(), z.array(z.string())),
});

/**
 * Extract and validate the `<triage>…</triage>` block. Returns the parsed
 * value only when Zod validation passes AND every queued id appears in
 * `scores`; anything else is unusable (caller takes the degraded path).
 */
export function parseTriageOutput(
  stdout: string,
  ids: readonly string[],
): TriageValue | undefined {
  const match = stdout.match(/<triage>([\s\S]*?)<\/triage>/);
  if (!match) {
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(match[1] ?? "");
  } catch {
    return undefined;
  }
  const parsed = TriageOutput.safeParse(json);
  if (!parsed.success) {
    return undefined;
  }
  const covers = ids.every((id) => parsed.data.scores[id] !== undefined);
  return covers ? parsed.data : undefined;
}

/**
 * WI-6 T6 (FR-009): the pre-merge review pass's three verdicts. `approve` is
 * the only verdict that lets a merge proceed; `wrong` (wrong root cause /
 * wrong test) and `uncertain` (cannot tell) both block it.
 */
export type ReviewVerdict = "approve" | "wrong" | "uncertain";

/**
 * Extract the `<review>…</review>` verdict (WI-6 T6, FR-009). Only the three
 * contract verdicts parse; a missing block, empty output, or any other content
 * is `uncertain` — the blocking class (FR-009: a verdict that fails to parse
 * counts as uncertain).
 */
export function parseReviewOutput(stdout: string): ReviewVerdict {
  const match = stdout.match(/<review>\s*(approve|wrong|uncertain)\s*<\/review>/);
  return match === null ? "uncertain" : (match[1] as ReviewVerdict);
}

/** Short scoring prompt — one block, per-issue score and likely-touched files. */
export function buildTriagePrompt(issues: readonly NormalizedIssue[]): string {
  const listing = issues
    .map((i) => `- ${i.id}: ${i.description.split("\n")[0] ?? i.id}`)
    .join("\n");
  return [
    "You are triaging a fix queue. For each issue below, give an integer priority",
    "from 1 (low) to 5 (urgent) and the repository files its fix likely touches.",
    "Answer with exactly one JSON block and nothing else inside it:",
    '<triage>{"scores":{"<id>":1-5},"files":{"<id>":["path/file.ext"]}}</triage>',
    "",
    listing,
  ].join("\n");
}

export interface NotAdmitted {
  readonly issue: NormalizedIssue;
  /** "cap", or "file overlap with gh-N" (decision 14). */
  readonly reason: string;
}

export interface AdmitInput {
  readonly issues: readonly NormalizedIssue[];
  /** Validated >= 1 by the CLI at startup (FR-003(f)); documented precondition. */
  readonly cap: number;
  readonly triage?: TriageValue;
  /** True when a triage pass ran but its output failed validation — degrade loudly. */
  readonly triageUnusable?: boolean;
}

export interface AdmitResult {
  readonly admitted: NormalizedIssue[];
  readonly notAdmitted: NotAdmitted[];
  readonly degraded: boolean;
}

function issueNumber(id: string): number {
  const digits = id.match(/(\d+)$/);
  return digits ? Number(digits[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * Admit at most `cap` issues. Default: ascending issue number, no model call.
 * With usable triage: score desc, ties ascending; an issue whose files overlap
 * an already-admitted issue's is deferred with the overlap named (decision 14).
 * With unusable triage: deterministic order, `degraded: true`.
 */
export function admitIssues(input: AdmitInput): AdmitResult {
  const useTriage = input.triage !== undefined && input.triageUnusable !== true;
  const ranked = [...input.issues].sort((a, b) => {
    if (useTriage) {
      const diff =
        (input.triage?.scores[b.id] ?? 0) - (input.triage?.scores[a.id] ?? 0);
      if (diff !== 0) {
        return diff;
      }
    }
    return issueNumber(a.id) - issueNumber(b.id);
  });

  const admitted: NormalizedIssue[] = [];
  const notAdmitted: NotAdmitted[] = [];
  const fileOwners = new Map<string, string>();

  for (const issue of ranked) {
    if (admitted.length >= input.cap) {
      notAdmitted.push({ issue, reason: "cap" });
      continue;
    }
    const overlapOwner = (input.triage?.files[issue.id] ?? []).find((f) =>
      fileOwners.has(f),
    );
    if (useTriage && overlapOwner !== undefined) {
      notAdmitted.push({ issue, reason: `file overlap with ${fileOwners.get(overlapOwner)}` });
      continue;
    }
    admitted.push(issue);
    for (const file of input.triage?.files[issue.id] ?? []) {
      fileOwners.set(file, issue.id);
    }
  }

  return {
    admitted,
    notAdmitted,
    degraded: input.triageUnusable === true,
  };
}
