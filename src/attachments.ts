/**
 * Attachment discovery and the confidentiality gate (WI-3, T1): uploaded
 * assets (screenshots, logs) referenced by an issue body are the payloads the
 * confidentiality constraint is actually about — plain issue text is already
 * covered by the WI-1/WI-2 seam. Discovery is source-independent: it reads
 * body text only, so a GitHub body, a spec-doc section, and a plain-list line
 * all funnel through the same scan.
 *
 * T2 adds the fetch itself: plain unauthenticated HTTPS, opaque bytes into
 * `.loop-harness/attachments/`, and a loud (never silent) degrade on failure.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/**
 * GitHub user-attachment uploads only. Deliberately not a general URL scan:
 * issue/PR links are navigation, not payloads, and must never trip the gate.
 * Module-private on purpose — the behavior is pinned by tests, not the pattern.
 */
const ATTACHMENT_URL_RE = /https:\/\/github\.com\/user-attachments\/[^\s)`\]]+/g;

/** Trailing prose punctuation a raw token match swallows (`See <url>.`). */
const TRAILING_PUNCTUATION = /[.,;:!?'"<>=]+$/;

/**
 * Distinct attachment URLs in first-seen order. Fenced blocks are part of the
 * body text and are scanned like any other prose — logs inside fences are the
 * common case.
 */
export function discoverAttachmentUrls(body: string): string[] {
  return [
    ...new Set(
      [...body.matchAll(ATTACHMENT_URL_RE)].map((m) => m[0].replace(TRAILING_PUNCTUATION, "")),
    ),
  ];
}

/** Named outcome for a blocked run — the gate refused, the loop did not fail. */
export class ConfidentialityGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfidentialityGateError";
  }
}

/**
 * FR-002: attachment URLs may leave the repo only when a human has explicitly
 * cleared it during onboarding. Throws iff there is at least one attachment
 * URL and the profile is not cleared — an uncleared repo with no attachments
 * proceeds (the WI-1/WI-2 seam already governs plain issue text).
 */
export function assertClearedForAttachments(
  profile: { readonly confidentialityCleared?: boolean },
  urls: readonly string[],
  repoName: string,
): void {
  if (urls.length > 0 && profile.confidentialityCleared !== true) {
    throw new ConfidentialityGateError(
      `${repoName}: issue references ${urls.length} attachment(s), but the repo is not ` +
        `cleared for third-party AI APIs. Either clear the repo (re-run onboarding with ` +
        `--confidentiality-cleared) or drop the attachment from the issue.`,
    );
  }
}

// ---------------------------------------------------------------------------
// T2: fetch + opaque delivery (FR-003) and loud degrade (FR-004).
// ---------------------------------------------------------------------------

/** Lines of head and tail kept in the prompt excerpt of a fetched attachment. */
export const EXCERPT_LINES = 20;

/** A fetched attachment: bytes staged host-side, delivered into the sandbox run. */
export interface StagedAttachment {
  readonly url: string;
  /**
   * Repo-relative path the bytes landed at
   * (`.loop-harness/attachments/<issueId>/<basename-from-URL>`) — also the
   * in-sandbox path, via Sandcastle's `copyToWorktree`.
   */
  readonly stagedPath: string;
  /** First/last `EXCERPT_LINES` — what the prompt inlines. */
  readonly excerpt: string;
}

/** A fetch that failed loudly — the issue still runs, degraded (FR-004). */
export interface AttachmentFetchFailure {
  /** The URL that failed — the only part recorded in prompts/PR bodies/summaries. */
  readonly failed: string;
  /** Why — diagnostic only; never emitted into prompts, PR bodies, or summaries. */
  readonly reason: string;
}

/**
 * First + last `EXCERPT_LINES` lines with a separator naming the total and the
 * full file's location. Content at or below the limit passes through verbatim.
 */
export function buildAttachmentExcerpt(content: string, stagedPath: string): string {
  const lines = content.split("\n");
  if (lines.length <= EXCERPT_LINES) {
    return content;
  }
  return [
    ...lines.slice(0, EXCERPT_LINES),
    `… (${lines.length} total lines, full file at ${stagedPath})`,
    ...lines.slice(-EXCERPT_LINES),
  ].join("\n");
}

const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECT_HOPS = 5;

/**
 * Fetch one attachment URL with plain unauthenticated HTTPS and stage the bytes
 * verbatim (no format parsing — opaque blob, PRD L37). Filename comes from the
 * URL, never from content sniffing. Never throws: any failure — HTTP error,
 * network error, timeout, redirect loop — is a loud `AttachmentFetchFailure`
 * the caller records. The `reason` stays diagnostic: only `failed` (the URL)
 * reaches prompts, PR bodies, and run summaries.
 */
export async function fetchAndStageAttachment(input: {
  readonly url: string;
  readonly repoDir: string;
  readonly issueId: string;
}): Promise<StagedAttachment | AttachmentFetchFailure> {
  try {
    // Inside the try on purpose: a malformed URL must degrade to a failure
    // result like every other fetch error, per the "Never throws" contract.
    const fileName = basename(new URL(input.url).pathname);
    const stagedPath = `.loop-harness/attachments/${input.issueId}/${fileName}`;
    const absolutePath = join(input.repoDir, stagedPath);
    let target = input.url;
    // A stubbed or manual 3xx surfaces here as a response, so redirects are
    // re-issued explicitly (real fetch follows them natively and never does).
    // No credential exists to set, so every hop is as bare as the first.
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
      const response = await fetch(target, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location !== null) {
        target = new URL(location, target).href;
        continue;
      }
      if (!response.ok) {
        return { failed: input.url, reason: `HTTP ${response.status} ${response.statusText}`.trim() };
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, bytes);
      // Staged bytes are inputs, never deliverables: the `.gitignore` guards
      // the host working tree immediately and travels with the `.loop-harness`
      // directory copy into the fix worktree, so a repo-wide `git add -A` on
      // either side cannot stage them. Idempotent — same content rewritten on
      // every successful stage.
      writeFileSync(join(dirname(absolutePath), ".gitignore"), "*\n");
      return {
        url: input.url,
        stagedPath,
        excerpt: buildAttachmentExcerpt(new TextDecoder().decode(bytes), stagedPath),
      };
    }
    return { failed: input.url, reason: `more than ${MAX_REDIRECT_HOPS} redirect hops` };
  } catch (error) {
    return { failed: input.url, reason: error instanceof Error ? error.message : String(error) };
  }
}
