/**
 * WI-16 T3 (FR-004/FR-010): the scenarios' fixture machinery — the clean-state
 * definition (SEED_COMMIT), the precondition check, the concurrency guard, the
 * reset, and the empty-queue label. Born red: every function throws until T3.2
 * implements it, so `npm run test:scenarios` fails on substance while
 * typecheck stays green.
 */
import { join } from "node:path";
import { tmpdir } from "node:os";

export { FIXTURE_CLONE_DIR, FIXTURE_REPO, TEST_IMAGE } from "../integration/fixture.js";

/** The one commit origin/main must sit at for any scenario to mean anything. */
export const SEED_COMMIT = "a4348dafa4aa328b908692ed46a1d4ddf9796fd7";

/** The guard's lock directory (mirrored in command.test.ts). */
export const GUARD_DIR = join(tmpdir(), "loop-integration-fixture.guard");

export function assertScenariosPreconditions(_env?: NodeJS.ProcessEnv): void {
  throw new Error("T3 born-red stub: assertScenariosPreconditions not implemented yet");
}

export function acquireFixtureGuard(): void {
  throw new Error("T3 born-red stub: acquireFixtureGuard not implemented yet");
}

export function releaseFixtureGuard(): void {
  throw new Error("T3 born-red stub: releaseFixtureGuard not implemented yet");
}

export function resetFixture(): void {
  throw new Error("T3 born-red stub: resetFixture not implemented yet");
}

export function ensureQueueEmptyLabel(): void {
  throw new Error("T3 born-red stub: ensureQueueEmptyLabel not implemented yet");
}
