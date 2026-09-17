import { mkdtemp, readFile } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertClearedForAttachments,
  buildAttachmentExcerpt,
  ConfidentialityGateError,
  discoverAttachmentUrls,
  EXCERPT_LINES,
  fetchAndStageAttachment,
} from "./attachments.js";

const A = "https://github.com/user-attachments/assets/aaaa";
const B = "https://github.com/user-attachments/assets/bbbb";
const C = "https://github.com/user-attachments/assets/cccc";

describe("discoverAttachmentUrls (T1, FR-001)", () => {
  it("finds a single attachment URL in prose", () => {
    expect(discoverAttachmentUrls(`Screenshot: ${A} shows the failure.`)).toEqual([A]);
  });

  it("returns a repeated URL once", () => {
    expect(discoverAttachmentUrls(`Before: ${A}\nAfter: ${A}`)).toEqual([A]);
  });

  it("finds a URL inside a code fence, deduped against the same URL in prose", () => {
    const body = `Repro output:\n\n\`\`\`\nlog line referencing ${A}\n\`\`\`\n\nSee also ${A} (same upload).`;
    expect(discoverAttachmentUrls(body)).toEqual([A]);
  });

  it("returns multiple URLs in first-seen order", () => {
    const body = `First ${C} then ${A} and again ${C} finally ${B}`;
    expect(discoverAttachmentUrls(body)).toEqual([C, A, B]);
  });

  it("returns [] for an inline log body with no URLs", () => {
    const body = "```\nTraceback (most recent call last):\nValueError: boom\n```";
    expect(discoverAttachmentUrls(body)).toEqual([]);
  });

  it("ignores non-attachment GitHub URLs such as issue links", () => {
    expect(discoverAttachmentUrls("Fixed by https://github.com/owner/repo/issues/1")).toEqual([]);
  });

  it("strips trailing prose punctuation from a URL", () => {
    const body = `See ${A}, then ${B}; finally ${C}.`;
    expect(discoverAttachmentUrls(body)).toEqual([A, B, C]);
  });
});

describe("attachment discovery is source-independent (FR-001)", () => {
  it("yields identical output for the same text from any issue source", () => {
    const body = `Log attached: ${A}\n\`\`\`\nstderr tail\n\`\`\`\nand a second asset ${B}`;
    const asGitHubBody = discoverAttachmentUrls(body);
    const asSpecDocSection = discoverAttachmentUrls(`## Failure\n\n${body}`);
    const asPlainListLine = discoverAttachmentUrls(`- crash on startup — ${body}`);
    expect(asSpecDocSection).toEqual(asGitHubBody);
    expect(asPlainListLine).toEqual(asGitHubBody);
  });
});

describe("assertClearedForAttachments (T1, FR-002)", () => {
  const REPO = "acme/client-web";

  it("throws ConfidentialityGateError naming the repo and both resolutions when not cleared", () => {
    expect(() =>
      assertClearedForAttachments({ confidentialityCleared: undefined }, [A], REPO),
    ).toThrow(ConfidentialityGateError);
    try {
      assertClearedForAttachments({ confidentialityCleared: undefined }, [A], REPO);
      expect.unreachable("gate must throw");
    } catch (err) {
      const gateErr = err as ConfidentialityGateError;
      expect(gateErr.name).toBe("ConfidentialityGateError");
      expect(gateErr.message).toContain(REPO);
      expect(gateErr.message).toContain("clear the repo");
      expect(gateErr.message).toContain("drop the attachment");
    }
  });

  it("passes when cleared and no attachment URLs are present", () => {
    expect(() =>
      assertClearedForAttachments({ confidentialityCleared: true }, [], REPO),
    ).not.toThrow();
  });

  it("passes when cleared and attachment URLs are present", () => {
    expect(() =>
      assertClearedForAttachments({ confidentialityCleared: true }, [A, B], REPO),
    ).not.toThrow();
  });

  it("passes when not cleared but no attachment URLs are present", () => {
    expect(() =>
      assertClearedForAttachments({ confidentialityCleared: undefined }, [], REPO),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// T2: fetch + opaque delivery (FR-003) and loud degrade (FR-004).
// ---------------------------------------------------------------------------

/** Header names of a captured RequestInit, tolerating plain objects and Headers. */
function headerNames(headers: unknown): string[] {
  if (headers === undefined || headers === null) return [];
  if (headers instanceof Headers) return [...headers.keys()];
  if (typeof headers === "object") return Object.keys(headers as Record<string, string>);
  return [];
}

describe("fetchAndStageAttachment (T2, FR-003)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stages fetched bytes verbatim (binary-safe) under .loop-harness/attachments/<issueId>/<basename>", async () => {
    // NUL + high bytes: the file is an opaque blob, never decoded before writing.
    const body = Uint8Array.from([0x23, 0x20, 0x6c, 0x6f, 0x67, 0x00, 0xff, 0xfe, 0x0a]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
    const repoDir = await mkdtemp(join(tmpdir(), "loop-attachments-"));
    try {
      const result = await fetchAndStageAttachment({ url: A, repoDir, issueId: "gh-3" });
      expect(result).toMatchObject({ url: A, stagedPath: ".loop-harness/attachments/gh-3/aaaa" });
      const staged = result as { excerpt: string };
      expect(staged.excerpt.length).toBeGreaterThan(0);
      const written = await readFile(join(repoDir, ".loop-harness", "attachments", "gh-3", "aaaa"));
      expect([...written]).toEqual([...body]);
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("stages a .gitignore (`*` + newline) beside the bytes so a `git add -A` cannot stage them here or in the worktree the directory copy feeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("client log line\n")));
    const repoDir = await mkdtemp(join(tmpdir(), "loop-attachments-"));
    try {
      const result = await fetchAndStageAttachment({ url: A, repoDir, issueId: "gh-3" });
      expect(result).toMatchObject({ url: A });
      const gitignore = await readFile(join(repoDir, ".loop-harness", "attachments", "gh-3", ".gitignore"), "utf8");
      expect(gitignore).toBe("*\n");
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("never sends an Authorization header on the initial request or any redirect hop", async () => {
    const redirectTarget = "https://objects.githubusercontent.com/assets/aaaa";
    const fetchStub = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      if (String(input) === A) {
        return new Response(null, { status: 302, headers: { location: redirectTarget } });
      }
      return new Response("line 1\nline 2\n");
    });
    vi.stubGlobal("fetch", fetchStub);
    const repoDir = await mkdtemp(join(tmpdir(), "loop-attachments-"));
    try {
      const result = await fetchAndStageAttachment({ url: A, repoDir, issueId: "gh-3" });
      expect(fetchStub).toHaveBeenCalledTimes(2); // initial request + one redirect hop
      for (const call of fetchStub.mock.calls) {
        const init = call[1] as RequestInit | undefined;
        const names = headerNames(init?.headers).map((n) => n.toLowerCase());
        expect(names).not.toContain("authorization");
      }
      // the redirect target's bytes are what got staged
      expect(result).toMatchObject({ url: A, stagedPath: ".loop-harness/attachments/gh-3/aaaa" });
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });
});

describe("fetchAndStageAttachment degrade (T2, FR-004)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns { failed, reason } — never throws — on a 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    const repoDir = await mkdtemp(join(tmpdir(), "loop-attachments-"));
    try {
      const result = await fetchAndStageAttachment({ url: A, repoDir, issueId: "gh-3" });
      expect(result).toMatchObject({ failed: A });
      expect((result as { reason: string }).reason).toMatch(/404/);
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("returns { failed, reason } when the fetch itself throws (network error/timeout)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("fetch failed: ENOTFOUND");
    }));
    const repoDir = await mkdtemp(join(tmpdir(), "loop-attachments-"));
    try {
      const result = await fetchAndStageAttachment({ url: A, repoDir, issueId: "gh-3" });
      expect(result).toMatchObject({ failed: A });
      expect((result as { reason: string }).reason).toContain("ENOTFOUND");
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("resolves to { failed, reason } — never throws — on a malformed URL", async () => {
    const repoDir = await mkdtemp(join(tmpdir(), "loop-attachments-"));
    try {
      const result = await fetchAndStageAttachment({ url: "not a url", repoDir, issueId: "gh-3" });
      expect("failed" in result).toBe(true);
      expect(result).toMatchObject({ failed: "not a url" });
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("a failing URL does not block the next one — both fetches are attempted", async () => {
    const fetchStub = vi.fn(async (input: string | URL | Request) =>
      String(input) === A ? new Response("gone", { status: 404 }) : new Response("ok log\n"),
    );
    vi.stubGlobal("fetch", fetchStub);
    const repoDir = await mkdtemp(join(tmpdir(), "loop-attachments-"));
    try {
      const first = await fetchAndStageAttachment({ url: A, repoDir, issueId: "gh-3" });
      const second = await fetchAndStageAttachment({ url: B, repoDir, issueId: "gh-3" });
      expect(first).toMatchObject({ failed: A });
      expect(second).toMatchObject({ url: B, stagedPath: ".loop-harness/attachments/gh-3/bbbb" });
      expect(fetchStub).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });
});

describe("buildAttachmentExcerpt (T2, FR-003)", () => {
  const PATH = ".loop-harness/attachments/gh-3/aaaa";

  it("EXCERPT_LINES is 20", () => {
    expect(EXCERPT_LINES).toBe(20);
  });

  it("returns content of EXCERPT_LINES or fewer lines verbatim", () => {
    const content = Array.from({ length: EXCERPT_LINES }, (_, i) => `line ${i + 1}`).join("\n");
    expect(buildAttachmentExcerpt(content, PATH)).toBe(content);
  });

  it("pins the first/last-20 shape with the total-lines/full-path separator", () => {
    const lines = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`);
    const excerpt = buildAttachmentExcerpt(lines.join("\n"), PATH);
    const expected = [
      ...lines.slice(0, EXCERPT_LINES),
      `… (60 total lines, full file at ${PATH})`,
      ...lines.slice(-EXCERPT_LINES),
    ].join("\n");
    expect(excerpt).toBe(expected);
  });
});
