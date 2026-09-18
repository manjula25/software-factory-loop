import { describe, expect, it } from "vitest";
import { onboardProfile, parseSuiteBaseline, SuiteDidNotRunError } from "./onboard-profile.js";

const RUN_FACTS = { baselineFailures: ["tests/test_slug.py::test_leading_digits"], durationSec: 42 };

describe("onboardProfile (T1, FR-002)", () => {
  it("omits confidentialityCleared entirely when the flag is absent — never false, never inferred", () => {
    const profile = onboardProfile(["/repos/client-web"], RUN_FACTS);
    expect("confidentialityCleared" in profile).toBe(false);
    expect(profile).toStrictEqual({
      language: "python",
      installCmd: 'pip install -e ".[test]"',
      testCmd: "pytest -q",
      singleTestCmd: "pytest -q {test}",
      baselineFailures: RUN_FACTS.baselineFailures,
      expectedDurationSec: RUN_FACTS.durationSec,
    });
  });

  it("records confidentialityCleared: true when --confidentiality-cleared is present (valueless)", () => {
    const profile = onboardProfile(["/repos/client-web", "--confidentiality-cleared"], RUN_FACTS);
    expect(profile.confidentialityCleared).toBe(true);
  });

  it("preserves --install/--test/--single-test passthrough values", () => {
    const argv = [
      "/repos/client-web",
      "--install",
      "make setup",
      "--test",
      "make check",
      "--single-test",
      "make one {test}",
    ];
    const profile = onboardProfile(argv, RUN_FACTS);
    expect(profile.installCmd).toBe("make setup");
    expect(profile.testCmd).toBe("make check");
    expect(profile.singleTestCmd).toBe("make one {test}");
  });
});

describe("parseSuiteBaseline (born-red guard replacement: execution evidence, not failure evidence)", () => {
  it("accepts a green suite: exit 0 with a summary line yields an empty baseline", () => {
    expect(parseSuiteBaseline(0, "....\n3 passed in 0.01s")).toEqual([]);
  });

  it("parses a failing suite into failure ids, same shapes parsePytestFailures pins", () => {
    const stdout = "F.\nFAILED tests/x.py::T::t - AssertionError: boom\n1 failed, 2 passed in 0.05s";
    expect(parseSuiteBaseline(1, stdout)).toEqual(["tests/x.py::T::t"]);
  });

  it("accepts a skipped-only suite: a counted outcome is execution evidence (shared definition)", () => {
    expect(parseSuiteBaseline(0, "ssss\n4 skipped in 0.01s")).toEqual([]);
  });

  it("throws SuiteDidNotRunError when stdout is empty — no evidence the suite ran", () => {
    expect(() => parseSuiteBaseline(0, "")).toThrow(SuiteDidNotRunError);
  });

  it("throws SuiteDidNotRunError when stdout has no pytest summary token, even with FAILED lines", () => {
    expect(() => parseSuiteBaseline(1, "some random output")).toThrow(SuiteDidNotRunError);
    expect(() =>
      parseSuiteBaseline(1, "FAILED tests/x.py::T::t - AssertionError: boom"),
    ).toThrow(SuiteDidNotRunError);
  });
});
