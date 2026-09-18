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
  /** Fenced-block log content (GitHub issues), or the `log:` / `| ` path-or-URL reference (spec docs, plain lists), when present. */
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
  /** The gh CLI's JSON field is `url` (the REST API's `html_url` equivalent). */
  readonly url?: string;
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
    ...(issue.url ? { url: issue.url } : {}),
  };
}

/**
 * Lowercase, non-alphanumerics to `-`, collapsed and trimmed (shared slug
 * seam). ASCII-only, and may return an empty string for input with no
 * alphanumerics.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A spec doc whose content has no `## ` section headings cannot yield issues. */
export class SpecDocParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpecDocParseError";
  }
}

/**
 * Parse a spec document into one `NormalizedIssue` per `## ` section (WI-3,
 * FR-005). Sections carry the heading text verbatim until the next `## `; a
 * `log: <path-or-url>` line inside a section binds `attachedLog` to that
 * section only. Spec docs have no source URL.
 */
export function parseSpecDoc(text: string): NormalizedIssue[] {
  const headings = [...text.matchAll(/^## (.+)$/gm)];
  if (headings.length === 0) {
    throw new SpecDocParseError(
      "spec doc has no '## ' section headings — nothing to normalize into issues",
    );
  }
  const seen = new Map<string, number>();
  return headings.map((match, index) => {
    const title = match[1];
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd =
      index + 1 < headings.length
        ? (headings[index + 1].index ?? text.length)
        : text.length;
    const body = text.slice(bodyStart, bodyEnd).trim();

    const logMatch = body.match(/^log:\s*(\S+)\s*$/m);
    const slug = slugify(title);
    const count = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, count);

    return {
      // slugify output can never contain `--` (runs collapse to one `-`), so a
      // `--N` counter id can never collide with a literal "Foo N" section's id.
      id: count === 1 ? `spec-${slug}` : `spec-${slug}--${count}`,
      description: `# ${title}\n\n${body}`.trim(),
      ...(logMatch ? { attachedLog: logMatch[1] } : {}),
      sourceType: "spec-doc" as const,
    };
  });
}

/** A plain list whose content has no entry lines cannot yield issues. */
export class PlainListParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlainListParseError";
  }
}

/**
 * Parse a plain list into one `NormalizedIssue` per non-empty, non-`#` line
 * (WI-3, FR-006). A trailing `| <path-or-url>` suffix binds `attachedLog`
 * (kept verbatim, no scheme or existence validation) to that entry only.
 * Plain lists have no source URL.
 */
export function parsePlainList(text: string): NormalizedIssue[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (lines.length === 0) {
    throw new PlainListParseError(
      "plain list has no entry lines — nothing to normalize into issues",
    );
  }
  const seen = new Map<string, number>();
  return lines.map((line) => {
    if (line.endsWith("|")) {
      throw new PlainListParseError(
        `malformed plain-list entry '${line}': trailing '|' with no path or URL after it`,
      );
    }
    const suffixMatch = line.match(/ \| (\S+)$/);
    const description = (
      suffixMatch ? line.slice(0, suffixMatch.index) : line
    ).trimEnd();
    const slug = slugify(description);
    const count = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, count);

    return {
      // slugify output can never contain `--` (runs collapse to one `-`), so a
      // `--N` counter id can never collide with a literal "Foo N" entry's id.
      id: count === 1 ? `list-${slug}` : `list-${slug}--${count}`,
      description,
      ...(suffixMatch ? { attachedLog: suffixMatch[1] } : {}),
      sourceType: "plain-list" as const,
    };
  });
}
