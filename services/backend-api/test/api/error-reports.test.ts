import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { generateTestId } from "../helpers/test-id";

describe("Error Reports API", { concurrency: true }, () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext();
  });

  after(async () => {
    await ctx.teardown();
  });

  describe("POST /api/v1/error-reports", () => {
    it("returns 401 when not authenticated", async () => {
      const response = await ctx.fetch("/api/v1/error-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Test error" }),
      });

      assert.strictEqual(response.status, 401);
    });

    it("returns ok: 1 when authenticated", async () => {
      const user = await ctx.asUser(generateTestId());

      const response = await user.fetch("/api/v1/error-reports", {
        method: "POST",
        body: JSON.stringify({
          message: "Test error",
          stack: "Error: Test\n    at test.ts:1:1",
        }),
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { ok: number };
      assert.strictEqual(body.ok, 1);
    });
  });
});
