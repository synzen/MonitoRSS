/**
 * Global test setup file for e2e tests.
 * This file is loaded once before all test files via --preload.
 * It sets up the shared integration test infrastructure.
 */
import { beforeAll, afterAll } from "bun:test";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "./helpers/setup-integration-tests";

// Global setup - runs once before all test files
beforeAll(async () => {
  await setupIntegrationTests();
});

// Global teardown - runs once after all test files
afterAll(async () => {
  await teardownIntegrationTests();
});
