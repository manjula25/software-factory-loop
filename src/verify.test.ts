import { describe, expect, it } from "vitest";
import { diffVerification, parsePytestFailures, SUITE_SUMMARY_RE } from "./verify.js";

const baselineOutput = `..F..F
=================================== FAILURES ===================================
______________________ test_slugify_strips_punctuation ________________________
>>> assert slugify("hello, world") == "hello-world"
E  AssertionError
tests/test_textops.py::test_slugify_strips_punctuation
=========================== short test summary info ============================
FAILED tests/test_textops.py::test_slugify_strips_punctuation - AssertionError
FAILED tests/test_dates.py::test_parse_iso8601 - ValueError: time data does not match
2 failed, 14 passed in 0.42s`;

describe("parse pytest output (FR-104)", () => {
  it("extracts failing test node ids from the short summary", () => {
    expect(parsePytestFailures(baselineOutput)).toEqual([
      "tests/test_textops.py::test_slugify_strips_punctuation",
      "tests/test_dates.py::test_parse_iso8601",
    ]);
  });

  it("returns an empty list for a clean run", () => {
    expect(parsePytestFailures("16 passed in 0.38s")).toEqual([]);
  });

  it("counts collection errors as failures", () => {
    expect(parsePytestFailures("ERROR tests/test_broken.py - ImportError: no module\n1 error in 0.1s")).toEqual([
      "tests/test_broken.py",
    ]);
  });
});

describe("SUITE_SUMMARY_RE (shared execution-evidence definition, WI-4 T3)", () => {
  it("matches a skipped-only summary — any counted outcome proves the suite ran", () => {
    expect(SUITE_SUMMARY_RE.test("4 skipped in 0.01s")).toBe(true);
  });

  it("does not match pytest's 'no tests ran' — no count, no execution evidence", () => {
    expect(SUITE_SUMMARY_RE.test("no tests ran in 0.01s")).toBe(false);
  });

  it("matches a mixed `pytest -q` summary line anywhere in stdout", () => {
    expect(SUITE_SUMMARY_RE.test("..F.\n1 failed, 2 passed, 3 skipped, 1 xfailed in 0.42s")).toBe(true);
  });

  it("does not match empty or count-free output", () => {
    expect(SUITE_SUMMARY_RE.test("")).toBe(false);
    expect(SUITE_SUMMARY_RE.test("some random output")).toBe(false);
  });

  it("does not match a zero count — '0 passed' is a suite that ran nothing", () => {
    // The rule is "a counted outcome proves the suite executed". Zero is a count
    // but not execution: pytest says "no tests ran" in this case, and a runner
    // that instead reports "0 passed" must not read as evidence (finding A-4).
    expect(SUITE_SUMMARY_RE.test("0 passed in 0.01s")).toBe(false);
    expect(SUITE_SUMMARY_RE.test("0 failed, 0 passed")).toBe(false);
  });

  it("still matches a real count that happens to contain a zero digit", () => {
    // The zero-exclusion must key on the count's value, not on the digit being
    // present: "10 passed" ran ten tests.
    expect(SUITE_SUMMARY_RE.test("10 passed in 1.20s")).toBe(true);
    expect(SUITE_SUMMARY_RE.test("20 skipped in 0.01s")).toBe(true);
  });
});

describe("diffVerification (baseline-diff gate, Grilling decision 6)", () => {
  const baseline = [
    "tests/test_textops.py::test_slugify_strips_punctuation",
    "tests/test_dates.py::test_parse_iso8601",
  ];

  it("passes when the only post-fix failures are pre-existing baseline ones", () => {
    const result = diffVerification({
      baselineFailures: baseline,
      postFixFailures: baseline,
      reproTestPassed: true,
    });
    expect(result.passed).toBe(true);
    expect(result.newFailures).toEqual([]);
  });

  it("fails naming the new failure when one appears", () => {
    const result = diffVerification({
      baselineFailures: baseline,
      postFixFailures: [
        ...baseline,
        "tests/test_textops.py::test_titlecase_handles_empty",
      ],
      reproTestPassed: true,
    });
    expect(result.passed).toBe(false);
    expect(result.newFailures).toEqual([
      "tests/test_textops.py::test_titlecase_handles_empty",
    ]);
  });

  it("fails regardless of baseline when the reproduction test does not pass", () => {
    const result = diffVerification({
      baselineFailures: baseline,
      postFixFailures: baseline,
      reproTestPassed: false,
    });
    expect(result.passed).toBe(false);
  });
});
