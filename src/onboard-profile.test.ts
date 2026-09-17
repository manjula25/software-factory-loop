import { describe, expect, it } from "vitest";
import { onboardProfile } from "./onboard-profile.js";

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
