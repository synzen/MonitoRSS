import { describe, it } from "node:test";
import assert from "node:assert";
import { GuildSubscriptionsService } from "../../src/services/guild-subscriptions/guild-subscriptions.service";
import type { Config } from "../../src/config";
import type { GuildSubscription } from "../../src/services/guild-subscriptions/types";
import { createServiceTestContext } from "../helpers/test-http-server";

describe("GuildSubscriptionsService", { concurrency: true }, () => {
  const baseMaxFeeds = 5;
  const guildId = "guild-id";

  const mockSubscription: GuildSubscription = {
    guild_id: "abc",
    extra_feeds: 100,
    refresh_rate: 111,
    expire_at: new Date("2029-09-09").toISOString(),
    ignore_refresh_rate_benefit: false,
  };

  describe("enabled state", { concurrency: true }, () => {
    it("sets enabled to true if required credentials exist", () => {
      const thisService = new GuildSubscriptionsService({
        BACKEND_API_SUBSCRIPTIONS_HOST: "host",
        BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN: "token",
        BACKEND_API_SUBSCRIPTIONS_ENABLED: true,
      } as Config);

      assert.strictEqual(thisService["enabled"], true);
    });

    it("sets enabled to false if some required credentials are missing", () => {
      const thisService = new GuildSubscriptionsService({
        BACKEND_API_SUBSCRIPTIONS_HOST: "host",
        BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN: undefined,
        BACKEND_API_SUBSCRIPTIONS_ENABLED: true,
      } as Config);

      assert.strictEqual(thisService["enabled"], false);
    });

    it("sets enabled to false if config env enabled is false", () => {
      const thisService = new GuildSubscriptionsService({
        BACKEND_API_SUBSCRIPTIONS_HOST: "host",
        BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN: "token",
        BACKEND_API_SUBSCRIPTIONS_ENABLED: false,
      } as Config);

      assert.strictEqual(thisService["enabled"], false);
    });
  });

  describe("getSubscription", { concurrency: true }, () => {
    it("returns null if service is not enabled", async () => {
      const ctx = createServiceTestContext({
        configOverrides: { BACKEND_API_SUBSCRIPTIONS_ENABLED: false },
      });

      try {
        const service = new GuildSubscriptionsService(ctx.config);
        const result = await service.getSubscription(guildId);
        assert.strictEqual(result, null);
      } finally {
        await ctx.close();
      }
    });

    it("returns null if 404", async () => {
      const ctx = createServiceTestContext();

      try {
        ctx.server.registerRoute("GET", `/guilds/${guildId}`, { status: 404 });
        const service = new GuildSubscriptionsService(ctx.config);
        const result = await service.getSubscription(guildId);
        assert.strictEqual(result, null);
      } finally {
        await ctx.close();
      }
    });

    it("returns null if server returns error status", async () => {
      const ctx = createServiceTestContext();

      try {
        ctx.server.registerRoute("GET", `/guilds/${guildId}`, { status: 500 });
        const service = new GuildSubscriptionsService(ctx.config);
        const result = await service.getSubscription(guildId);
        assert.strictEqual(result, null);
      } finally {
        await ctx.close();
      }
    });

    it("returns the correctly formatted object on success", async () => {
      const ctx = createServiceTestContext();

      try {
        ctx.server.registerRoute("GET", `/guilds/${guildId}`, {
          status: 200,
          body: mockSubscription,
        });
        const service = new GuildSubscriptionsService(ctx.config);
        const result = await service.getSubscription(guildId);

        assert.deepStrictEqual(result, {
          guildId: mockSubscription.guild_id,
          maxFeeds: baseMaxFeeds + mockSubscription.extra_feeds,
          refreshRate: mockSubscription.refresh_rate,
          expireAt: mockSubscription.expire_at,
          slowRate: false,
        });
      } finally {
        await ctx.close();
      }
    });

    it("returns slowRate true if ignore_refresh_rate_benefit is true", async () => {
      const ctx = createServiceTestContext();

      try {
        ctx.server.registerRoute("GET", `/guilds/${guildId}`, {
          status: 200,
          body: { ...mockSubscription, ignore_refresh_rate_benefit: true },
        });
        const service = new GuildSubscriptionsService(ctx.config);
        const result = await service.getSubscription(guildId);

        assert.strictEqual(result?.slowRate, true);
      } finally {
        await ctx.close();
      }
    });

    it("sends the correct authorization header", async () => {
      const ctx = createServiceTestContext();

      try {
        ctx.server.registerRoute("GET", `/guilds/${guildId}`, {
          status: 200,
          body: mockSubscription,
        });
        const service = new GuildSubscriptionsService(ctx.config);
        await service.getSubscription(guildId);

        const requests = ctx.server.getRequestsForPath(`/guilds/${guildId}`);
        assert.strictEqual(requests.length, 1);
        assert.strictEqual(
          requests[0]!.headers.authorization,
          "test-access-token"
        );
      } finally {
        await ctx.close();
      }
    });
  });

  describe("getAllSubscriptions", { concurrency: true }, () => {
    it("returns empty array if disabled", async () => {
      const ctx = createServiceTestContext({
        configOverrides: { BACKEND_API_SUBSCRIPTIONS_ENABLED: false },
      });

      try {
        const service = new GuildSubscriptionsService(ctx.config);
        const result = await service.getAllSubscriptions();
        assert.deepStrictEqual(result, []);
      } finally {
        await ctx.close();
      }
    });

    it("returns empty array if server returns error status", async () => {
      const ctx = createServiceTestContext();

      try {
        ctx.server.registerRoute("GET", "/guilds", { status: 500 });
        const service = new GuildSubscriptionsService(ctx.config);
        const result = await service.getAllSubscriptions();
        assert.deepStrictEqual(result, []);
      } finally {
        await ctx.close();
      }
    });

    it("returns the correctly formatted objects on success", async () => {
      const ctx = createServiceTestContext();

      try {
        const allSubscriptions = [mockSubscription, mockSubscription];
        ctx.server.registerRoute("GET", "/guilds", {
          status: 200,
          body: allSubscriptions,
        });
        const service = new GuildSubscriptionsService(ctx.config);
        const result = await service.getAllSubscriptions();

        assert.deepStrictEqual(
          result,
          allSubscriptions.map((sub) => ({
            guildId: sub.guild_id,
            maxFeeds: baseMaxFeeds + sub.extra_feeds,
            refreshRate: sub.refresh_rate,
            expireAt: sub.expire_at,
            slowRate: sub.ignore_refresh_rate_benefit,
          }))
        );
      } finally {
        await ctx.close();
      }
    });

    it("sends the correct authorization header and query params", async () => {
      const ctx = createServiceTestContext();

      try {
        const filters = { serverIds: ["123", "456"] };
        ctx.server.registerRoute("GET", "/guilds", { status: 200, body: [] });
        const service = new GuildSubscriptionsService(ctx.config);
        await service.getAllSubscriptions({ filters });

        const requests = ctx.server.getRequestsForPath("/guilds");
        assert.strictEqual(requests.length, 1);
        assert.strictEqual(
          requests[0]!.headers.authorization,
          "test-access-token"
        );
        assert.ok(requests[0]!.url.includes("filters"));
      } finally {
        await ctx.close();
      }
    });
  });
});
