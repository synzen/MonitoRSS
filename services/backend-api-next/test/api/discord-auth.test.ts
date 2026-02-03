import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import type { SessionAccessToken } from "../../src/services/discord-auth/types";

describe("Discord Auth API", { concurrency: true }, () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext();
  });

  after(async () => {
    await ctx.teardown();
  });

  describe("GET /api/v1/discord/login", () => {
    it("returns 301 redirect to Discord OAuth URL", async () => {
      const response = await ctx.fetch("/api/v1/discord/login", {
        redirect: "manual",
      });

      assert.strictEqual(response.status, 301);

      const location = response.headers.get("location");
      assert.ok(location, "Should have Location header");
      assert.ok(
        location.startsWith(`${ctx.discordMockServer.host}/oauth2/authorize`),
        "Should redirect to Discord OAuth",
      );
      assert.ok(location.includes("client_id=test-client-id"));
      assert.ok(
        location.includes("scope=identify guilds") ||
          location.includes("scope=identify%20guilds"),
        "Should include scope parameter",
      );
      assert.ok(location.includes("response_type=code"));
    });
  });

  describe("GET /api/v1/discord/login-v2", () => {
    it("returns 303 redirect to Discord OAuth URL", async () => {
      const response = await ctx.fetch("/api/v1/discord/login-v2", {
        redirect: "manual",
      });
      assert.strictEqual(response.status, 303);
      const location = response.headers.get("location");
      assert.ok(
        location?.startsWith(`${ctx.discordMockServer.host}/oauth2/authorize`),
      );
    });

    it("sets Cache-Control: no-store header", async () => {
      const response = await ctx.fetch("/api/v1/discord/login-v2", {
        redirect: "manual",
      });
      assert.strictEqual(response.headers.get("cache-control"), "no-store");
    });

    it("includes state parameter in redirect URL", async () => {
      const response = await ctx.fetch("/api/v1/discord/login-v2", {
        redirect: "manual",
      });
      const location = response.headers.get("location");
      assert.ok(location?.includes("&state="));
    });

    it("stores authState in session cookie", async () => {
      const response = await ctx.fetch("/api/v1/discord/login-v2", {
        redirect: "manual",
      });
      assert.ok(response.headers.get("set-cookie"));
    });

    it("handles jsonState query parameter", async () => {
      const jsonState = encodeURIComponent(
        JSON.stringify({ path: "/servers" }),
      );
      const response = await ctx.fetch(
        `/api/v1/discord/login-v2?jsonState=${jsonState}`,
        { redirect: "manual" },
      );
      assert.strictEqual(response.status, 303);
      assert.ok(response.headers.get("location")?.includes("&state="));
    });

    it("handles addScopes query parameter", async () => {
      const addScopes = encodeURIComponent("email");
      const response = await ctx.fetch(
        `/api/v1/discord/login-v2?addScopes=${addScopes}`,
        { redirect: "manual" },
      );
      assert.strictEqual(response.status, 303);
      const location = response.headers.get("location") || "";
      assert.ok(
        location.includes("scope=identify%20guilds%20email") ||
          location.includes("scope=identify guilds email"),
      );
    });
  });

  describe("GET /api/v1/discord/callback", () => {
    it("redirects to home with 301 when error=access_denied", async () => {
      const response = await ctx.fetch(
        "/api/v1/discord/callback?error=access_denied",
        { redirect: "manual" },
      );
      assert.strictEqual(response.status, 301);
      assert.strictEqual(response.headers.get("location"), "/");
    });

    it("returns 'No code provided' when code is missing", async () => {
      const response = await ctx.fetch("/api/v1/discord/callback");
      const text = await response.text();
      assert.strictEqual(text, "No code provided");
    });
  });

  describe("GET /api/v1/discord/callback-v2", () => {
    it("redirects to home with 303 when error=access_denied", async () => {
      const response = await ctx.fetch(
        "/api/v1/discord/callback-v2?error=access_denied",
        { redirect: "manual" },
      );
      assert.strictEqual(response.status, 303);
      assert.strictEqual(response.headers.get("location"), "/");
    });

    it("returns 400 when code is missing", async () => {
      const response = await ctx.fetch("/api/v1/discord/callback-v2");
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string; message: string };
      assert.strictEqual(body.code, "INVALID_AUTH_CODE");
      assert.strictEqual(body.message, "Invalid code");
    });

    it("returns 400 when state is missing", async () => {
      const response = await ctx.fetch(
        "/api/v1/discord/callback-v2?code=test-code",
      );
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string; message: string };
      assert.strictEqual(body.code, "INVALID_AUTH_STATE");
      assert.strictEqual(body.message, "Invalid state");
    });

    it("returns 400 when state does not match stored state", async () => {
      const loginRes = await ctx.fetch("/api/v1/discord/login-v2", {
        redirect: "manual",
      });
      const cookies = loginRes.headers.get("set-cookie");

      const response = await ctx.fetch(
        "/api/v1/discord/callback-v2?code=test-code&state=wrong-state",
        {
          headers: { cookie: cookies || "" },
        },
      );
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string; message: string };
      assert.strictEqual(body.code, "INVALID_AUTH_STATE");
      assert.strictEqual(body.message, "Invalid state");
    });
  });

  describe("GET /api/v1/discord/logout", () => {
    it("returns 401 without session", async () => {
      const response = await ctx.fetch("/api/v1/discord/logout");
      assert.strictEqual(response.status, 401);
    });
  });
});

describe("Discord Auth Logout with session", { concurrency: false }, () => {
  let logoutCtx: AppTestContext;
  const mockAccessToken: SessionAccessToken = {
    access_token: "mock-access-token",
    token_type: "Bearer",
    expires_in: 604800,
    refresh_token: "mock-refresh-token",
    scope: "identify guilds",
    expiresAt: Math.floor(Date.now() / 1000) + 604800,
    discord: { id: "123456789" },
  };

  before(async () => {
    logoutCtx = await createAppTestContext();
    logoutCtx.container.discordAuthService.revokeToken = async () => {};
  });

  after(async () => {
    await logoutCtx.teardown();
  });

  it("returns 204 when logged in and revokes token", async () => {
    let revokedToken: unknown = null;
    logoutCtx.container.discordAuthService.revokeToken = async (token) => {
      revokedToken = token;
    };

    const cookies = await logoutCtx.setSession(mockAccessToken);

    const response = await logoutCtx.fetch("/api/v1/discord/logout", {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 204);
    assert.deepStrictEqual(revokedToken, mockAccessToken);
  });

  it("clears session after logout", async () => {
    const cookies = await logoutCtx.setSession(mockAccessToken);

    const response = await logoutCtx.fetch("/api/v1/discord/logout", {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 204);

    const logoutCookies = response.headers.get("set-cookie");
    const secondLogoutRes = await logoutCtx.fetch("/api/v1/discord/logout", {
      headers: { cookie: logoutCookies || cookies },
    });
    assert.strictEqual(
      secondLogoutRes.status,
      401,
      "Session should be cleared after logout",
    );
  });
});
