import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";

function createSentryEnvelope(dsn: string): string {
  const header = JSON.stringify({ dsn });
  const itemHeader = JSON.stringify({ type: "event" });
  const payload = JSON.stringify({ message: "test error" });
  return `${header}\n${itemHeader}\n${payload}`;
}

describe("Sentry Tunnel API", { concurrency: true }, () => {
  describe("when Sentry is not configured", () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext();
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns ok when Sentry host is not configured", async () => {
      const envelope = createSentryEnvelope("https://key@sentry.io/123");

      const response = await ctx.fetch("/api/v1/sentry-tunnel", {
        method: "POST",
        body: envelope,
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { ok: number };
      assert.strictEqual(body.ok, 1);
    });
  });

  describe("when Sentry is configured", () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_SENTRY_HOST: "sentry.example.com",
          BACKEND_API_SENTRY_PROJECT_IDS: ["123", "456"],
        },
      });
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns 400 when hostname does not match configured host", async () => {
      const envelope = createSentryEnvelope(
        "https://key@wrong-host.sentry.io/123",
      );

      const response = await ctx.fetch("/api/v1/sentry-tunnel", {
        method: "POST",
        body: envelope,
      });

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string; message: string };
      assert.strictEqual(body.code, "INVALID_REQUEST");
      assert.ok(body.message.includes("Invalid sentry hostname"));
    });

    it("returns 400 when project ID is not in allowed list", async () => {
      const envelope = createSentryEnvelope(
        "https://key@sentry.example.com/999",
      );

      const response = await ctx.fetch("/api/v1/sentry-tunnel", {
        method: "POST",
        body: envelope,
      });

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string; message: string };
      assert.strictEqual(body.code, "INVALID_REQUEST");
      assert.ok(body.message.includes("Invalid sentry project id"));
    });

    it("returns 400 when envelope has invalid JSON header", async () => {
      const invalidEnvelope = "not-valid-json\n{}\n{}";

      const response = await ctx.fetch("/api/v1/sentry-tunnel", {
        method: "POST",
        body: invalidEnvelope,
      });

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string; message: string };
      assert.strictEqual(body.code, "INVALID_REQUEST");
      assert.ok(body.message.includes("malformed header JSON"));
    });

    it("returns 400 when envelope is empty", async () => {
      const response = await ctx.fetch("/api/v1/sentry-tunnel", {
        method: "POST",
        body: "",
      });

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string; message: string };
      assert.strictEqual(body.code, "INVALID_REQUEST");
      assert.ok(body.message.includes("missing header"));
    });

    it("returns 400 when DSN URL is malformed", async () => {
      const envelope = JSON.stringify({ dsn: "not-a-valid-url" }) + "\n{}\n{}";

      const response = await ctx.fetch("/api/v1/sentry-tunnel", {
        method: "POST",
        body: envelope,
      });

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string; message: string };
      assert.strictEqual(body.code, "INVALID_REQUEST");
      assert.ok(body.message.includes("malformed DSN URL"));
    });

    it("returns 400 when header is missing DSN field", async () => {
      const envelope = JSON.stringify({ other: "field" }) + "\n{}\n{}";

      const response = await ctx.fetch("/api/v1/sentry-tunnel", {
        method: "POST",
        body: envelope,
      });

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string; message: string };
      assert.strictEqual(body.code, "INVALID_REQUEST");
      assert.ok(body.message.includes("malformed DSN URL"));
    });

    it("returns ok with valid envelope", async () => {
      const envelope = createSentryEnvelope(
        "https://key@sentry.example.com/123",
      );

      const response = await ctx.fetch("/api/v1/sentry-tunnel", {
        method: "POST",
        body: envelope,
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { ok: number };
      assert.strictEqual(body.ok, 1);
    });
  });
});
