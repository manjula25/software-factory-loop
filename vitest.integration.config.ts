import { defineConfig } from "vitest/config";

/**
 * WI-16 (FR-011): the integration scenarios' own surface, deliberately separate
 * from `vitest.config.ts` — which is left exactly as it is, so `npm test` cannot
 * change. `npm run test:integration` is the command; see `docs/agents/workflow.md`.
 */
export default defineConfig({
  test: {
    // Deliberately false, and the opposite of the default gate's setting: an
    // integration command that finds no tests must fail, not report success.
    // A check that cannot fail is not evidence.
    passWithNoTests: false,
    include: ["tests/integration/**/*.test.ts"],
    // These tests shell out to `gh` and `docker`. A cold `gh repo clone` plus a
    // container run with `pip install` measured ~14s at T1.3 — past vitest's 5s
    // default, so the suite failed on the clock rather than on its subject
    // (`docs/work/WI-16/evidence/t1-fixture-green.log`).
    //
    // Five minutes is a bound, not a target: it is deliberately far above what
    // anything here needs today, so the number is not mistaken for a budget. A
    // scenario that legitimately needs longer raises it with its own evidence.
    testTimeout: 300_000,
  },
});