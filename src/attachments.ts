/**
 * Attachment discovery and the confidentiality gate (WI-3, T1): uploaded
 * assets (screenshots, logs) referenced by an issue body are the payloads the
 * confidentiality constraint is actually about — plain issue text is already
 * covered by the WI-1/WI-2 seam. Discovery is source-independent: it reads
 * body text only, so a GitHub body, a spec-doc section, and a plain-list line
 * all funnel through the same scan.
 */

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
