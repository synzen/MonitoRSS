import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  setupTestDatabase,
  teardownTestDatabase,
} from "../helpers/setup-test-database";
import { createTestContext, type TestContext } from "../helpers/test-context";
import type { Connection } from "mongoose";

describe("Health API", { concurrency: true }, () => {
  let mongoConnection: Connection;
  let ctx: TestContext;

  before(async () => {
    mongoConnection = await setupTestDatabase();
    ctx = await createTestContext({ mongoConnection });
  });

  after(async () => {
    await ctx.close();
    await teardownTestDatabase();
  });

  describe("GET /api/v1/health", () => {
    it("returns 200 with status ok", async () => {
      const response = await ctx.fetch("/api/v1/health");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { status: string };
      assert.strictEqual(body.status, "ok");
    });
  });

  describe("404 handling", () => {
    it("returns 404 for unknown routes", async () => {
      const response = await ctx.fetch("/unknown-route");

      assert.strictEqual(response.status, 404);
      const body = (await response.json()) as { error: string };
      assert.strictEqual(body.error, "Not Found");
    });
  });
});
