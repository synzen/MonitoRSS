import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { generateTestId } from "../helpers/test-id";

describe("Discovery Search Events API", { concurrency: true }, () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext();
  });

  after(async () => {
    await ctx.teardown();
  });

  describe("POST /api/v1/discovery-search-events", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await ctx.fetch("/api/v1/discovery-search-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchTerm: "steam", resultCount: 3 }),
      });

      assert.strictEqual(response.status, 401);
    });

    it("returns 204 with valid input", async () => {
      const user = await ctx.asUser(generateTestId());

      const response = await user.fetch("/api/v1/discovery-search-events", {
        method: "POST",
        body: JSON.stringify({ searchTerm: "steam", resultCount: 3 }),
      });

      assert.strictEqual(response.status, 204);
    });

    it("returns 400 with empty searchTerm", async () => {
      const user = await ctx.asUser(generateTestId());

      const response = await user.fetch("/api/v1/discovery-search-events", {
        method: "POST",
        body: JSON.stringify({ searchTerm: "", resultCount: 3 }),
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 with negative resultCount", async () => {
      const user = await ctx.asUser(generateTestId());

      const response = await user.fetch("/api/v1/discovery-search-events", {
        method: "POST",
        body: JSON.stringify({ searchTerm: "steam", resultCount: -1 }),
      });

      assert.strictEqual(response.status, 400);
    });

    it("returns 204 with whitespace and uppercase input", async () => {
      const user = await ctx.asUser(generateTestId());

      const response = await user.fetch("/api/v1/discovery-search-events", {
        method: "POST",
        body: JSON.stringify({ searchTerm: "  STEAM  ", resultCount: 0 }),
      });

      assert.strictEqual(response.status, 204);
    });
  });
});
