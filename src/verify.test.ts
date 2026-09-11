import { describe, expect, it } from "vitest";
import { diffVerification, parsePytestFailures } from "./verify.js";

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
