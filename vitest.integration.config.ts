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
  },
});