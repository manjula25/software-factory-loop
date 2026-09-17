import { describe, expect, it } from "vitest";
import {
  assertClearedForAttachments,
  ConfidentialityGateError,
  discoverAttachmentUrls,
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
