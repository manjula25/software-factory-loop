import { describe, expect, it } from "vitest";
import { normalizeGitHubIssue } from "./issues.js";

describe("issue normalization (WI-1 slice)", () => {
  it("normalizes a fetched GitHub issue to the internal shape", () => {
    const ghIssue = {
      number: 7,
      title: "slugify drops leading digits",
      body: "Calling slugify('7 seas') returns '-seas' instead of '7-seas'.\n\n```\nTraceback (most recent call last):\n  File \"t.py\", line 3, in <module>\nValueError: leading digit\n```",
      url: "https://github.com/manjula25/loop-fixtures-py/issues/7",
    };
    const normalized = normalizeGitHubIssue(ghIssue);
    expect(normalized.id).toBe("gh-7");
    expect(normalized.sourceType).toBe("github-issue");
    expect(normalized.description).toContain("slugify('7 seas')");
    expect(normalized.attachedLog).toContain("Traceback (most recent call last):");
    expect(normalized.url).toBe(ghIssue.url);
  });

  it("keeps the body as description verbatim and omits attachedLog when no fenced block exists", () => {
    const ghIssue = {
      number: 8,
      title: "Docs typo",
      body: "README says 'pytohn'.",
      url: "https://github.com/manjula25/loop-fixtures-py/issues/8",
    };
    const normalized = normalizeGitHubIssue(ghIssue);
    expect(normalized.description).toBe("# Docs typo\n\nREADME says 'pytohn'.");
    expect(normalized.attachedLog).toBeUndefined();
  });

  it("extracts the largest fenced block as the attached log", () => {
    const ghIssue = {
      number: 9,
      title: "flaky",
      body: "short block:\n```\nboom\n```\nreal log:\n```\nline1\nline2\nline3\n```",
    };
    const normalized = normalizeGitHubIssue(ghIssue);
    expect(normalized.attachedLog).toContain("line1");
    expect(normalized.attachedLog).toContain("line3");
    expect(normalized.attachedLog).not.toContain("boom");
  });
});
