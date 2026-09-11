/**
 * Issue normalization (PRD "new component", WI-1 slice): every source —
 * GitHub Issues now, spec docs and plain lists in WI-2 — funnels into the
 * single internal `NormalizedIssue` shape before the loop ever sees it.
 */

export type IssueSourceType = "github-issue" | "spec-doc" | "plain-list";

export interface NormalizedIssue {
  /** Stable internal id, e.g. `gh-7` (source-prefixed). */
  readonly id: string;
  /** Symptom-first description the agent works from (title + body, verbatim). */
  readonly description: string;
  /** Largest fenced block in the body, when present — often a stack trace. */
  readonly attachedLog?: string;
  readonly sourceType: IssueSourceType;
  /** Source URL when the issue has one. */
  readonly url?: string;
}

/** The slice of `gh issue view --json` output the normalizer consumes. */
export interface GitHubIssueInput {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly html_url?: string;
}

export function normalizeGitHubIssue(issue: GitHubIssueInput): NormalizedIssue {
  const body = issue.body ?? "";
  const blocks = [...body.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const attachedLog = blocks.reduce<string | undefined>(
    (longest, block) => (longest === undefined || block.length > longest.length ? block : longest),
    undefined,
  );
  return {
    id: `gh-${issue.number}`,
    description: `# ${issue.title}\n\n${body}`.trim(),
    ...(attachedLog !== undefined ? { attachedLog } : {}),
    sourceType: "github-issue",
    ...(issue.html_url ? { url: issue.html_url } : {}),
  };
}
