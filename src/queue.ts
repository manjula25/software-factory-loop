/**
 * Queue ingestion (WI-2): acquiring the target repo's open issues and
 * normalizing them through the WI-1 normalizer. Acquisition is one page at
 * a bounded limit — the page is also the ceiling on downstream planner spend.
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
// Plan output (WI-13 FR-001): one planning pass over the whole queue —
// priorities plus a dependency graph the queue runner walks in parallel.
// ---------------------------------------------------------------------------

/** Zod-validated plan output — Sandcastle's `Output.object` pattern (decision 15). */
export interface PlanValue {
  readonly priority: Readonly<Record<string, number>>;
  readonly blockedBy: Readonly<Record<string, readonly string[]>>;
}

const PlanOutput = z.object({
  priority: z.record(z.string(), z.number().int().min(1).max(5)),
  blockedBy: z.record(z.string(), z.array(z.string())),
});

/**
 * Whether the blockedBy edges form any loop (WI-13 FR-001). A cyclic plan can
 * never be scheduled — some issue waits forever — so it is unusable outright.
 * Simple DFS walk from every node over edges restricted to known ids.
 */
function planHasCycle(blockedBy: Readonly<Record<string, readonly string[]>>): boolean {
  const VISITING = 1;
  const DONE = 2;
  const state = new Map<string, number>();

  function walk(id: string): boolean {
    const s = state.get(id);
    if (s === VISITING) {
      return true; // back-edge: a loop
    }
    if (s === DONE) {
      return false;
    }
    state.set(id, VISITING);
    for (const blocker of blockedBy[id] ?? []) {
      if (walk(blocker)) {
        return true;
      }
    }
    state.set(id, DONE);
    return false;
  }

  return Object.keys(blockedBy).some(walk);
}

/**
 * Extract and validate the `<plan>…</plan>` block (WI-13 FR-001). Returns the
 * parsed value only when Zod validation passes AND every queued id appears in
 * `priority`, every blockedBy edge names a queued id (never the issue itself),
 * and the edges are acyclic; anything else is unusable — the caller takes the
 * degraded path (deterministic order, loud warning, run continues).
 */
export function parsePlanOutput(
  stdout: string,
  ids: readonly string[],
): PlanValue | undefined {
  const match = stdout.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!match) {
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(match[1] ?? "");
  } catch {
    return undefined;
  }
  const parsed = PlanOutput.safeParse(json);
  if (!parsed.success) {
    return undefined;
  }
  const covers = ids.every((id) => parsed.data.priority[id] !== undefined);
  if (!covers) {
    return undefined;
  }
  const known = new Set(ids);
  for (const [id, blockers] of Object.entries(parsed.data.blockedBy)) {
    // An edge to an id the queue never held, or to itself, makes the plan
    // unusable: the runner could never satisfy it.
    if (!known.has(id) || blockers.some((b) => b === id || !known.has(b))) {
      return undefined;
    }
  }
  return planHasCycle(parsed.data.blockedBy) ? undefined : parsed.data;
}

/**
 * The planning pass's prompt (WI-13 FR-001): ids with first description lines
 * only, one JSON block as the contract. Defines blocked-by for the planner and
 * states the all-blocked rule so the plan can never deadlock the whole queue.
 */
export function buildPlanPrompt(issues: readonly NormalizedIssue[]): string {
  const listing = issues
    .map((i) => `- ${i.id}: ${i.description.split("\n")[0] ?? i.id}`)
    .join("\n");
  return [
    "You are planning a fix queue. For each issue below, give an integer priority",
    "from 1 (low) to 5 (urgent) and the ids of the issues it is blocked by.",
    "Issue B is blocked by issue A when B's fix depends on a decision, API",
    "shape, or code state A's fix will establish, or when both fixes likely",
    "touch the same files.",
    "If every issue is blocked, give the single highest-priority candidate the highest priority and NO blockers.",
    "Answer with exactly one JSON block and nothing else inside it:",
    '<plan>{"priority":{"<id>":1-5},"blockedBy":{"<id>":["<id>"]}}</plan>',
    "",
    listing,
  ].join("\n");
}

/**
 * Order the queue by a validated plan (WI-13 FR-001): priority desc, ties by
 * ascending issue number. The blockedBy graph is NOT consulted here: it shapes
 * which issues may run in parallel, which is the queue runner's job, not this
 * ordering's. Iterates the queue's `issues`, never the plan's keys — the
 * parser tolerates extra priority keys, so a key-driven walk could surface
 * phantom issues downstream (controller finding A1). No plan (unusable or
 * never run): ascending issue-number order on a copy, input never mutated.
 */
export function orderFromPlan(
  issues: readonly NormalizedIssue[],
  plan: PlanValue | undefined,
): NormalizedIssue[] {
  return [...issues].sort((a, b) => {
    if (plan !== undefined) {
      const diff = (plan.priority[b.id] ?? 0) - (plan.priority[a.id] ?? 0);
      if (diff !== 0) {
        return diff;
      }
    }
    return issueNumber(a.id) - issueNumber(b.id);
  });
}

/**
 * The wave-scheduling primitive (WI-13 FR-002/FR-003): the issues from
 * `order` — preserving `order`'s ranking, excluding ids already in
 * `completed` (later waves pass the SAME full order with a grown `completed`
 * set, so done issues must never come back) — whose blockers, as named by
 * `edges[id]`, are all in `completed`. Only edges whose blocker is itself IN
 * the run (`order`) count: an edge naming an id this run never held is
 * ignored — an unknown/absent blocker cannot gate a run. Issues with no
 * `edges` entry are unblocked. The runner's initial wave is
 * `unblockedAfter(order, edges, new Set())`; on opted-in repos `completed`
 * grows with MERGED issues, on non-opted with lanes that settled with a PR
 * (FR-002). Acyclicity is the parser's guarantee (`parsePlanOutput` rejects
 * cycles), so an empty result with issues remaining means the all-blocked ∅
 * case — the caller's fallback trigger (highest-priority remaining issue,
 * the planner's all-blocked rule made mechanical — T6).
 */
export function unblockedAfter(
  order: readonly NormalizedIssue[],
  edges: Readonly<Record<string, readonly string[]>>,
  completed: ReadonlySet<string>,
): NormalizedIssue[] {
  const inRun = new Set(order.map((issue) => issue.id));
  return order.filter(
    (issue) =>
      !completed.has(issue.id) &&
      (edges[issue.id] ?? []).every(
        (blocker) => !inRun.has(blocker) || completed.has(blocker),
      ),
  );
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

/** Trailing number of an issue id (`gh-12` → 12) — `orderFromPlan`'s tie rule. */
function issueNumber(id: string): number {
  const digits = id.match(/(\d+)$/);
  return digits ? Number(digits[1]) : Number.MAX_SAFE_INTEGER;
}
