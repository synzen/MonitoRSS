import { describe, it, beforeEach, mock, afterEach } from "node:test";
import assert from "node:assert";
import { DiscordAuthService } from "../../src/services/discord-auth/discord-auth.service";
import { MANAGE_CHANNEL } from "../../src/shared/constants/discord-permissions";
import type { Config } from "../../src/config";
import type { DiscordApiService } from "../../src/services/discord-api/discord-api.service";
import type { SessionAccessToken } from "../../src/services/discord-auth/types";

describe("DiscordAuthService", { concurrency: true }, () => {
  const clientId = "client-123";
  const clientSecret = "secret-456";
  const redirectUri = "https://example.com/callback";
  const mockConfig = {
    BACKEND_API_DISCORD_CLIENT_ID: clientId,
    BACKEND_API_DISCORD_CLIENT_SECRET: clientSecret,
    BACKEND_API_DISCORD_REDIRECT_URI: redirectUri,
  } as Config;

  const createMockDiscordApiService = (overrides: Record<string, unknown> = {}) => ({
    executeBearerRequest: mock.fn(),
    ...overrides,
  }) as unknown as DiscordApiService;

  describe("getAuthorizationUrl", () => {
    let service: DiscordAuthService;

    beforeEach(() => {
      service = new DiscordAuthService(mockConfig, createMockDiscordApiService());
    });

    it("returns the correct URL with default scopes", () => {
      const url = service.getAuthorizationUrl();

      assert.ok(url.includes("client_id=" + clientId));
      assert.ok(url.includes("redirect_uri=" + redirectUri));
      assert.ok(url.includes("scope=identify guilds"));
      assert.ok(url.includes("response_type=code"));
      assert.ok(url.includes("prompt=consent"));
    });

    it("includes state parameter when provided", () => {
      const url = service.getAuthorizationUrl({ state: "my-state" });

      assert.ok(url.includes("state=my-state"));
    });

    it("includes additional scopes when provided", () => {
      const url = service.getAuthorizationUrl({ additionalScopes: " email" });

      assert.ok(url.includes("scope=identify guilds email"));
    });
  });

  describe("isTokenExpired", () => {
    let service: DiscordAuthService;

    beforeEach(() => {
      service = new DiscordAuthService(mockConfig, createMockDiscordApiService());
    });

    it("returns true when token is expired", () => {
      const expiredToken = {
        expiresAt: Math.floor(Date.now() / 1000) - 3600,
      } as SessionAccessToken;

      const result = service.isTokenExpired(expiredToken);

      assert.strictEqual(result, true);
    });

    it("returns false when token is not expired", () => {
      const validToken = {
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      } as SessionAccessToken;

      const result = service.isTokenExpired(validToken);

      assert.strictEqual(result, false);
    });
  });

  describe("userManagesGuild", () => {
    it("returns isManager false when user is not in guild", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        executeBearerRequest: mock.fn(() => Promise.resolve([
          { id: "other-guild", owner: false, permissions: "0" },
        ])),
      });
      const service = new DiscordAuthService(mockConfig, mockDiscordApiService);

      const result = await service.userManagesGuild("access-token", "target-guild");

      assert.strictEqual(result.isManager, false);
      assert.strictEqual(result.permissions, null);
    });

    it("returns isManager true when user is guild owner", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        executeBearerRequest: mock.fn(() => Promise.resolve([
          { id: "target-guild", owner: true, permissions: "0" },
        ])),
      });
      const service = new DiscordAuthService(mockConfig, mockDiscordApiService);

      const result = await service.userManagesGuild("access-token", "target-guild");

      assert.strictEqual(result.isManager, true);
      assert.strictEqual(result.permissions, "0");
    });

    it("returns isManager true when user has MANAGE_CHANNEL permission", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        executeBearerRequest: mock.fn(() => Promise.resolve([
          { id: "target-guild", owner: false, permissions: MANAGE_CHANNEL.toString() },
        ])),
      });
      const service = new DiscordAuthService(mockConfig, mockDiscordApiService);

      const result = await service.userManagesGuild("access-token", "target-guild");

      assert.strictEqual(result.isManager, true);
    });

    it("returns isManager false when user lacks MANAGE_CHANNEL permission", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        executeBearerRequest: mock.fn(() => Promise.resolve([
          { id: "target-guild", owner: false, permissions: "0" },
        ])),
      });
      const service = new DiscordAuthService(mockConfig, mockDiscordApiService);

      const result = await service.userManagesGuild("access-token", "target-guild");

      assert.strictEqual(result.isManager, false);
    });
  });

  describe("getUser", () => {
    it("returns user from Discord API", async () => {
      const user = { id: "user-123", username: "testuser", discriminator: "0001", avatar: null };
      const mockDiscordApiService = createMockDiscordApiService({
        executeBearerRequest: mock.fn(() => Promise.resolve(user)),
      });
      const service = new DiscordAuthService(mockConfig, mockDiscordApiService);

      const result = await service.getUser("access-token");

      assert.deepStrictEqual(result, user);
    });
  });

  describe("createAccessToken", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("creates access token successfully", async () => {
      const tokenResponse = {
        access_token: "new-access-token",
        token_type: "Bearer",
        expires_in: 604800,
        refresh_token: "new-refresh-token",
        scope: "identify guilds",
      };
      const user = { id: "user-123", username: "testuser", discriminator: "0001", avatar: null };

      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(tokenResponse),
        } as Response)
      ) as typeof fetch;

      const mockDiscordApiService = createMockDiscordApiService({
        executeBearerRequest: mock.fn(() => Promise.resolve(user)),
      });
      const service = new DiscordAuthService(mockConfig, mockDiscordApiService);

      const result = await service.createAccessToken("auth-code");

      assert.strictEqual(result.token.access_token, "new-access-token");
      assert.strictEqual(result.token.discord.id, "user-123");
      assert.ok(result.token.expiresAt > 0);
      assert.deepStrictEqual(result.user, user);
    });

    it("throws error on non-ok response with status < 500", async () => {
      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: "invalid_grant" }),
        } as Response)
      ) as typeof fetch;

      const service = new DiscordAuthService(mockConfig, createMockDiscordApiService());

      await assert.rejects(
        () => service.createAccessToken("bad-auth-code"),
        /Failed to create access token \(400\)/
      );
    });

    it("throws error on 500+ response", async () => {
      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        } as Response)
      ) as typeof fetch;

      const service = new DiscordAuthService(mockConfig, createMockDiscordApiService());

      await assert.rejects(
        () => service.createAccessToken("auth-code"),
        /Discord internal error/
      );
    });
  });

  describe("refreshToken", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("refreshes token successfully", async () => {
      const tokenResponse = {
        access_token: "refreshed-access-token",
        token_type: "Bearer",
        expires_in: 604800,
        refresh_token: "new-refresh-token",
        scope: "identify guilds",
      };
      const user = { id: "user-123", username: "testuser", discriminator: "0001", avatar: null };

      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(tokenResponse),
        } as Response)
      ) as typeof fetch;

      const mockDiscordApiService = createMockDiscordApiService({
        executeBearerRequest: mock.fn(() => Promise.resolve(user)),
      });
      const service = new DiscordAuthService(mockConfig, mockDiscordApiService);

      const result = await service.refreshToken({
        access_token: "old-access-token",
        token_type: "Bearer",
        expires_in: 604800,
        refresh_token: "old-refresh-token",
        scope: "identify guilds",
      });

      assert.strictEqual(result.access_token, "refreshed-access-token");
      assert.strictEqual(result.discord.id, "user-123");
    });
  });

  describe("revokeToken", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("revokes both access and refresh tokens", async () => {
      const fetchMock = mock.fn(() =>
        Promise.resolve({ ok: true } as Response)
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const service = new DiscordAuthService(mockConfig, createMockDiscordApiService());

      await service.revokeToken({
        access_token: "access-token",
        token_type: "Bearer",
        expires_in: 604800,
        refresh_token: "refresh-token",
        scope: "identify guilds",
      });

      assert.strictEqual(fetchMock.mock.calls.length, 2);
    });

    it("throws error when revocation fails", async () => {
      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: "invalid_token" }),
        } as Response)
      ) as typeof fetch;

      const service = new DiscordAuthService(mockConfig, createMockDiscordApiService());

      await assert.rejects(
        () => service.revokeToken({
          access_token: "access-token",
          token_type: "Bearer",
          expires_in: 604800,
          refresh_token: "refresh-token",
          scope: "identify guilds",
        }),
        /Failed to revoke/
      );
    });
  });
});
