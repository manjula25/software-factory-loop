import { describe, expect, it } from "vitest";
import {
  normalizeGitHubIssue,
  parsePlainList,
  parseSpecDoc,
  PlainListParseError,
  slugify,
  SpecDocParseError,
} from "./issues.js";

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

describe("spec-doc normalization (WI-3, FR-005)", () => {
  const threeSectionDoc = [
    "# Release 2.1 known issues",
    "",
    "log: ./logs/preamble-ignored.txt",
    "",
    "## Camera JSON overwrite",
    "",
    "Saving twice clobbers the first frame.",
    "",
    "log: ./logs/a.txt",
    "",
    "## Export hangs on empty timeline",
    "",
    "Export never finishes.",
    "",
    "log: https://github.com/user-attachments/assets/x",
    "",
    "## Docs typo",
    "",
    "README says 'pytohn'.",
    "",
  ].join("\n");

  it("normalizes each ## section to the GitHub-issue entry shape", () => {
    const entries = parseSpecDoc(threeSectionDoc);
    expect(entries).toHaveLength(3);

    // Hand-built GitHub-issue entry with the same title/body: description and
    // attachedLog presence must match; only sourceType and url differ.
    const ghEquivalent = normalizeGitHubIssue({
      number: 1,
      title: "Camera JSON overwrite",
      body: "Saving twice clobbers the first frame.\n\nlog: ./logs/a.txt",
      url: "https://github.com/manjula25/loop-fixtures-py/issues/1",
    });

    const [camera, exportHangs, docsTypo] = entries;
    expect(camera.id).toBe("spec-camera-json-overwrite");
    expect(camera.description).toBe(ghEquivalent.description);
    expect(camera.attachedLog).toBe("./logs/a.txt");
    expect(camera.sourceType).toBe("spec-doc");
    expect("url" in camera).toBe(false);

    expect(exportHangs.id).toBe("spec-export-hangs-on-empty-timeline");
    expect(exportHangs.description).toBe(
      "# Export hangs on empty timeline\n\nExport never finishes.\n\nlog: https://github.com/user-attachments/assets/x",
    );
    expect(exportHangs.attachedLog).toBe("https://github.com/user-attachments/assets/x");

    // Present-iff-bound: a section without a `log:` line has no attachedLog.
    expect(docsTypo.id).toBe("spec-docs-typo");
    expect("attachedLog" in docsTypo).toBe(false);
  });

  it("slugifies titles and disambiguates duplicate headings with a counter", () => {
    expect(slugify("Camera JSON overwrite")).toBe("camera-json-overwrite");
    expect(slugify("  Camera   JSON -- overwrite!!  ")).toBe("camera-json-overwrite");

    const doc = "## Camera JSON overwrite\n\nfirst\n\n## Camera JSON overwrite\n\nsecond\n";
    const entries = parseSpecDoc(doc);
    expect(entries.map((e) => e.id)).toEqual([
      "spec-camera-json-overwrite",
      "spec-camera-json-overwrite--2",
    ]);
  });

  it("a duplicate's counter id never collides with a literal 'Foo 2' heading's id", () => {
    // slugify("Foo 2") is "foo-2" and slugify output can never contain "--",
    // so the duplicate counter (spec-foo--2) and the literal's plain id
    // (spec-foo-2) are distinct by construction.
    const doc = "## Foo\n\none\n\n## Foo\n\ntwo\n\n## Foo 2\n\nthree\n";
    const entries = parseSpecDoc(doc);
    expect(entries.map((e) => e.id)).toEqual(["spec-foo", "spec-foo--2", "spec-foo-2"]);
    expect(new Set(entries.map((e) => e.id)).size).toBe(3);
  });

  it("throws SpecDocParseError on content with zero ## headings", () => {
    for (const doc of [
      "# Only an h1\n\nNo h2 sections here.",
      "### Only h3s\n\nStill no h2 sections.",
      "No headings at all, just prose.",
    ]) {
      try {
        parseSpecDoc(doc);
        expect.unreachable("expected SpecDocParseError");
      } catch (err) {
        expect(err).toBeInstanceOf(SpecDocParseError);
        expect(err).toBeInstanceOf(Error);
        expect((err as SpecDocParseError).name).toBe("SpecDocParseError");
        expect((err as Error).message).toContain("##");
      }
    }
  });

  it("binds a log: line only to its own section and ignores one before any ## heading", () => {
    const doc = [
      "log: ./logs/preamble-ignored.txt",
      "",
      "## First bug",
      "",
      "One.",
      "",
      "log: ./logs/first.txt",
      "",
      "## Second bug",
      "",
      "Two.",
      "",
    ].join("\n");
    const [first, second] = parseSpecDoc(doc);
    expect(first.attachedLog).toBe("./logs/first.txt");
    expect("attachedLog" in second).toBe(false);
    expect(first.description).not.toContain("preamble-ignored");
    expect(second.description).not.toContain("preamble-ignored");
  });

  it("keeps the description as the heading line plus content verbatim until the next ##", () => {
    const doc = [
      "## Verbatim section",
      "",
      "Body line 1.",
      "Body line 2 with   odd   spacing.",
      "",
      "log: ./logs/v.txt",
      "",
      "## Next section",
      "",
      "Other.",
    ].join("\n");
    const [verbatim] = parseSpecDoc(doc);
    expect(verbatim.description).toBe(
      "# Verbatim section\n\nBody line 1.\nBody line 2 with   odd   spacing.\n\nlog: ./logs/v.txt",
    );
  });
});

describe("plain-list normalization (WI-3, FR-006)", () => {
  const threeEntryList = [
    "# Known issues from the field",
    "",
    "Camera JSON overwrite | ./logs/b.log",
    "# interjected comment",
    "Export hangs on empty timeline | https://github.com/user-attachments/assets/y",
    "Docs typo",
  ].join("\n");

  it("normalizes each entry line to the GitHub-issue entry shape", () => {
    const entries = parsePlainList(threeEntryList);
    expect(entries).toHaveLength(3);

    const [camera, exportHangs, docsTypo] = entries;
    expect(camera.id).toBe("list-camera-json-overwrite");
    expect(camera.description).toBe("Camera JSON overwrite");
    expect(camera.attachedLog).toBe("./logs/b.log");
    expect(camera.sourceType).toBe("plain-list");
    expect("url" in camera).toBe(false);

    expect(exportHangs.id).toBe("list-export-hangs-on-empty-timeline");
    expect(exportHangs.description).toBe("Export hangs on empty timeline");
    expect(exportHangs.attachedLog).toBe("https://github.com/user-attachments/assets/y");
    expect("url" in exportHangs).toBe(false);

    // Present-iff-bound: an entry line without a `| ` suffix has no attachedLog.
    expect(docsTypo.id).toBe("list-docs-typo");
    expect(docsTypo.description).toBe("Docs typo");
    expect("attachedLog" in docsTypo).toBe(false);
    expect("url" in docsTypo).toBe(false);
  });

  it("slugifies entry text and disambiguates duplicate lines with a counter", () => {
    const entries = parsePlainList("Camera JSON overwrite\n\nCamera JSON overwrite\n");
    expect(entries.map((e) => e.id)).toEqual([
      "list-camera-json-overwrite",
      "list-camera-json-overwrite--2",
    ]);
  });

  it("a duplicate's counter id never collides with a literal 'Foo 2' line's id", () => {
    // slugify("Foo 2") is "foo-2" and slugify output can never contain "--",
    // so the duplicate counter (list-foo--2) and the literal's plain id
    // (list-foo-2) are distinct by construction.
    const entries = parsePlainList("Foo\n\nFoo\n\nFoo 2\n");
    expect(entries.map((e) => e.id)).toEqual(["list-foo", "list-foo--2", "list-foo-2"]);
    expect(new Set(entries.map((e) => e.id)).size).toBe(3);
  });

  it("throws PlainListParseError on comments-only and empty text", () => {
    for (const text of ["# only a comment\n\n# another one\n", "", "   \n\n"]) {
      try {
        parsePlainList(text);
        expect.unreachable("expected PlainListParseError");
      } catch (err) {
        expect(err).toBeInstanceOf(PlainListParseError);
        expect(err).toBeInstanceOf(Error);
        expect((err as PlainListParseError).name).toBe("PlainListParseError");
        expect((err as Error).message).toContain("plain list");
      }
    }
  });

  it("throws PlainListParseError on a trailing pipe with no value — never silently drops it", () => {
    try {
      parsePlainList("good entry\nDocs typo |");
      expect.unreachable("expected PlainListParseError");
    } catch (err) {
      expect(err).toBeInstanceOf(PlainListParseError);
      expect((err as Error).message).toContain("Docs typo |");
    }
  });

  it("strips the | suffix from the description and keeps the value verbatim in attachedLog", () => {
    // Opaque single-token value: a Windows path — no scheme, no existence check.
    const [entry] = parsePlainList("Windows path log | C:\\logs\\win.txt");
    expect(entry.description).toBe("Windows path log");
    expect(entry.attachedLog).toBe("C:\\logs\\win.txt");
  });
});
