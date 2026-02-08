import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";

describe("Reddit Auth API", { concurrency: true }, () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext({
      configOverrides: {
        BACKEND_API_REDDIT_CLIENT_ID: "test-reddit-client-id",
        BACKEND_API_REDDIT_CLIENT_SECRET: "test-reddit-client-secret",
        BACKEND_API_REDDIT_REDIRECT_URI:
          "http://localhost:3000/reddit/callback",
        BACKEND_API_ENCRYPTION_KEY_HEX:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
    });
  });

  after(async () => {
    await ctx.teardown();
  });

  describe("GET /api/v1/reddit/login", () => {
    it("returns 303 redirect to Reddit OAuth URL", async () => {
      const response = await ctx.fetch("/api/v1/reddit/login", {
        redirect: "manual",
      });

      assert.strictEqual(response.status, 303);

      const location = response.headers.get("location");
      assert.ok(location, "Should have Location header");
      assert.ok(
        location.startsWith("https://www.reddit.com/api/v1/authorize"),
        "Should redirect to Reddit OAuth",
      );
      assert.ok(location.includes("client_id="));
      assert.ok(location.includes("response_type=code"));
      assert.ok(location.includes("scope=read"));
      assert.ok(location.includes("duration=permanent"));
    });

    it("sets Cache-Control: no-store header", async () => {
      const response = await ctx.fetch("/api/v1/reddit/login", {
        redirect: "manual",
      });
      assert.strictEqual(response.headers.get("cache-control"), "no-store");
    });

    it("includes state parameter in redirect URL", async () => {
      const response = await ctx.fetch("/api/v1/reddit/login", {
        redirect: "manual",
      });
      const location = response.headers.get("location");
      assert.ok(location?.includes("state="));
    });
  });

  describe("GET /api/v1/reddit/remove", { concurrency: true }, () => {
    it("returns 401 without auth", async () => {
      const response = await ctx.fetch("/api/v1/reddit/remove");
      assert.strictEqual(response.status, 401);
    });

    it("returns 204 when user has no Reddit credentials", async () => {
      const user = await ctx.asUser("user-no-reddit-creds");
      const response = await user.fetch("/api/v1/reddit/remove");
      assert.strictEqual(response.status, 204);
    });

    it("sets Cache-Control: no-store header", async () => {
      const user = await ctx.asUser("user-cache-test-remove");
      const response = await user.fetch("/api/v1/reddit/remove");
      assert.strictEqual(response.headers.get("cache-control"), "no-store");
    });
  });

  describe("GET /api/v1/reddit/callback", { concurrency: true }, () => {
    it("returns 401 without auth", async () => {
      const response = await ctx.fetch("/api/v1/reddit/callback?code=abc123");
      assert.strictEqual(response.status, 401);
    });

    it("returns HTML that closes window when error parameter is present", async () => {
      const user = await ctx.asUser("user-callback-error");
      const response = await user.fetch(
        "/api/v1/reddit/callback?error=access_denied",
      );

      assert.strictEqual(response.status, 200);
      const contentType = response.headers.get("content-type");
      assert.ok(
        contentType?.startsWith("text/html"),
        "Should return text/html",
      );
      const body = await response.text();
      assert.ok(body.includes("window.close()"));
    });

    it("returns 'No code available' when code is missing", async () => {
      const user = await ctx.asUser("user-callback-no-code");
      const response = await user.fetch("/api/v1/reddit/callback");

      assert.strictEqual(response.status, 200);
      const body = await response.text();
      assert.strictEqual(body, "No code available");
    });

    it("sets Cache-Control: no-store header", async () => {
      const user = await ctx.asUser("user-callback-cache");
      const response = await user.fetch("/api/v1/reddit/callback");

      assert.strictEqual(response.headers.get("cache-control"), "no-store");
    });

    it("exchanges code for tokens and returns HTML with postMessage on success", async () => {
      const user = await ctx.asUser("user-callback-success");

      const mockGetAccessToken = mock.method(
        ctx.container.redditApiService,
        "getAccessToken",
        async () => ({
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
          token_type: "bearer" as const,
          scope: "read",
        }),
      );

      const response = await user.fetch(
        "/api/v1/reddit/callback?code=valid-auth-code",
      );

      assert.strictEqual(response.status, 200);
      const contentType = response.headers.get("content-type");
      assert.ok(
        contentType?.startsWith("text/html"),
        "Should return text/html",
      );

      const body = await response.text();
      assert.ok(
        body.includes("window.opener.postMessage('reddit', '*')"),
        "Should post message to opener",
      );
      assert.ok(body.includes("window.close()"), "Should close window");

      assert.strictEqual(mockGetAccessToken.mock.calls.length, 1);
      const firstCall = mockGetAccessToken.mock.calls[0];
      assert.ok(firstCall, "Should have a call");
      assert.strictEqual(firstCall.arguments[0], "valid-auth-code");

      mockGetAccessToken.mock.restore();
    });
  });
});
