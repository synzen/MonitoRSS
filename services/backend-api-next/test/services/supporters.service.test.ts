import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import dayjs from "dayjs";
import { PatronStatus, SubscriptionProductKey } from "../../src/repositories/shared/enums";
import {
  createSupportersHarness,
  TEST_DEFAULTS,
} from "../helpers/supporters.harness";

describe("SupportersService", { concurrency: true }, () => {
  const harness = createSupportersHarness();

  before(() => harness.setup());
  after(() => harness.teardown());

  describe("getBenefitsOfDiscordUser", () => {
    it("returns defaults for all values if no supporter is found", async () => {
      const ctx = harness.createContext();

      const benefits = await ctx.service.getBenefitsOfDiscordUser(ctx.discordUserId);

      assert.strictEqual(benefits.isSupporter, false);
      assert.strictEqual(benefits.maxFeeds, TEST_DEFAULTS.maxFeeds);
      assert.deepStrictEqual(benefits.guilds, []);
      assert.strictEqual(benefits.maxGuilds, 0);
      assert.deepStrictEqual(benefits.maxUserFeedsComposition, {
        base: TEST_DEFAULTS.maxUserFeeds,
        legacy: 0,
      });
      assert.strictEqual(benefits.maxDailyArticles, TEST_DEFAULTS.maxDailyArticlesDefault);
      assert.strictEqual(benefits.maxUserFeeds, TEST_DEFAULTS.maxUserFeeds);
    });

    it("returns the correct benefits for a valid supporter", async () => {
      const ctx = harness.createContext();
      const supporter = await ctx.createValidSupporter({
        maxGuilds: 10,
        maxFeeds: 11,
        guilds: ["guild-1", "guild-2"],
      });

      const benefits = await ctx.service.getBenefitsOfDiscordUser(ctx.discordUserId);

      assert.strictEqual(benefits.isSupporter, true);
      assert.strictEqual(benefits.maxFeeds, supporter.maxFeeds);
      assert.deepStrictEqual(benefits.guilds, supporter.guilds);
      assert.strictEqual(benefits.maxGuilds, supporter.maxGuilds);
      assert.strictEqual(benefits.refreshRateSeconds, 120);
      assert.strictEqual(benefits.maxDailyArticles, TEST_DEFAULTS.maxDailyArticlesSupporter);
    });
  });

  describe("getBenefitsOfServers", () => {
    it("always returns results for every input server id", async () => {
      const ctx = harness.createContext();
      const serverIds = [ctx.generateServerId(), ctx.generateServerId(), ctx.generateServerId()];

      const result = await ctx.service.getBenefitsOfServers(serverIds);

      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0]!.hasSupporter, false);
      assert.strictEqual(result[0]!.maxFeeds, TEST_DEFAULTS.maxFeeds);
      assert.strictEqual(result[0]!.serverId, serverIds[0]);
      assert.strictEqual(result[0]!.webhooks, false);
    });

    describe("when there is no patron", () => {
      it("returns the supporter max feeds if supporter is not expired", async () => {
        const ctx = harness.createContext();
        const serverId = ctx.generateServerId();
        const supporter = await ctx.createSupporterWithGuild(serverId, {
          maxFeeds: 10,
          expireAt: dayjs().add(3, "day").toDate(),
        });

        const result = await ctx.service.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, supporter.maxFeeds);
      });

      it("returns the default max feeds if supporter is expired", async () => {
        const ctx = harness.createContext();
        const serverId = ctx.generateServerId();
        await ctx.createSupporterWithGuild(serverId, {
          maxFeeds: 10,
          expireAt: dayjs().subtract(1, "day").toDate(),
        });

        const result = await ctx.service.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, TEST_DEFAULTS.maxFeeds);
      });

      it("returns the default max feeds if supporter is not found", async () => {
        const ctx = harness.createContext();
        const serverId = ctx.generateServerId();

        const result = await ctx.service.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, TEST_DEFAULTS.maxFeeds);
      });

      it("returns default max feeds if guild supporter has no expire at and no patrons", async () => {
        const ctx = harness.createContext();
        const serverId = ctx.generateServerId();
        await ctx.createSupporterWithGuild(serverId, { maxFeeds: 10 });

        const result = await ctx.service.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, TEST_DEFAULTS.maxFeeds);
      });

      it("returns webhook and hasSupporter false for a supporter that expired", async () => {
        const ctx = harness.createContext();
        const serverId = ctx.generateServerId();
        await ctx.createSupporterWithGuild(serverId, {
          maxFeeds: 10,
          expireAt: dayjs().subtract(10, "day").toDate(),
        });

        const result = await ctx.service.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.hasSupporter, false);
        assert.strictEqual(result[0]!.webhooks, false);
      });
    });

    describe("when there is a patron", () => {
      it("returns hasSupporter: true and webhooks: true", async () => {
        const ctx = harness.createContext();
        const serverId = ctx.generateServerId();
        await ctx.createSupporterWithGuild(serverId, { maxGuilds: 10, maxFeeds: 10 });
        await ctx.createActivePatron();

        const result = await ctx.service.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.hasSupporter, true);
        assert.strictEqual(result[0]!.webhooks, true);
      });

      it("returns the max feeds of an active patron", async () => {
        const ctx = harness.createContext();
        const serverId = ctx.generateServerId();
        await ctx.createSupporterWithGuild(serverId, { maxGuilds: 10, maxFeeds: 10 });
        await ctx.createActivePatron();

        const result = await ctx.service.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, 10);
      });

      it("returns the max feeds of a declined patron within the grace period", async () => {
        const ctx = harness.createContext();
        const serverId = ctx.generateServerId();
        await ctx.createSupporterWithGuild(serverId, { maxGuilds: 10, maxFeeds: 10 });
        await ctx.createPatron({
          status: PatronStatus.DECLINED,
          pledge: 100,
          lastCharge: dayjs().subtract(2, "days").toDate(),
        });

        const result = await ctx.service.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, 10);
      });

      it("does not return the supporter max feeds of a long-expired declined patron", async () => {
        const ctx = harness.createContext();
        const serverId = ctx.generateServerId();
        await ctx.createSupporterWithGuild(serverId, { maxGuilds: 10, maxFeeds: 10 });
        await ctx.createPatron({
          status: PatronStatus.DECLINED,
          pledge: 100,
          lastCharge: dayjs().subtract(6, "days").toDate(),
        });

        const result = await ctx.service.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, TEST_DEFAULTS.maxFeeds);
      });

      it("does not return supporter max feeds of a former patron", async () => {
        const ctx = harness.createContext();
        const serverId = ctx.generateServerId();
        await ctx.createSupporterWithGuild(serverId, { maxGuilds: 10, maxFeeds: 10 });
        await ctx.createPatron({
          status: PatronStatus.FORMER,
          pledge: 100,
        });

        const result = await ctx.service.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, TEST_DEFAULTS.maxFeeds);
      });
    });

    describe("for multiple servers", () => {
      it("returns the max feeds correctly", async () => {
        const ctx1 = harness.createContext();
        const ctx2 = harness.createContext();
        const serverId1 = ctx1.generateServerId();
        const serverId2 = ctx2.generateServerId();

        await ctx1.createSupporterWithGuild(serverId1, {
          maxGuilds: 10,
          maxFeeds: 10,
          expireAt: dayjs().add(1, "month").toDate(),
        });
        await ctx2.createSupporterWithGuild(serverId2, {
          maxGuilds: 20,
          maxFeeds: 20,
          expireAt: dayjs().add(1, "month").toDate(),
        });

        const result = await ctx1.service.getBenefitsOfServers([serverId1, serverId2]);

        assert.strictEqual(result.length, 2);
        const server1 = result.find((r) => r.serverId === serverId1);
        const server2 = result.find((r) => r.serverId === serverId2);
        assert.strictEqual(server1?.maxFeeds, 10);
        assert.strictEqual(server2?.maxFeeds, 20);
      });

      it("returns webhook for every valid supporter", async () => {
        const ctx1 = harness.createContext();
        const ctx2 = harness.createContext();
        const serverId1 = ctx1.generateServerId();
        const serverId2 = ctx2.generateServerId();

        await ctx1.createValidSupporter({ guilds: [serverId1] });
        await ctx2.createValidSupporter({ guilds: [serverId2] });

        const result = await ctx1.service.getBenefitsOfServers([serverId1, serverId2]);

        assert.strictEqual(result.length, 2);
        assert.ok(result.every((r) => r.webhooks));
      });

      it("returns max feeds correctly when a single guild has multiple supporters", async () => {
        const ctx1 = harness.createContext();
        const ctx2 = harness.createContext();
        const ctx3 = harness.createContext();
        const serverId1 = ctx1.generateServerId();
        const serverId2 = ctx2.generateServerId();

        await ctx1.createValidSupporter({
          guilds: [serverId1],
          maxGuilds: 10,
          maxFeeds: 10,
        });
        await ctx2.createValidSupporter({
          guilds: [serverId1, serverId2],
          maxGuilds: 20,
          maxFeeds: 20,
        });
        await ctx3.createValidSupporter({
          guilds: [serverId2],
          maxGuilds: 30,
          maxFeeds: 30,
        });

        const result = await ctx1.service.getBenefitsOfServers([serverId1, serverId2]);

        assert.strictEqual(result.length, 2);
        const server1 = result.find((r) => r.serverId === serverId1);
        const server2 = result.find((r) => r.serverId === serverId2);
        assert.strictEqual(server1?.maxFeeds, 20);
        assert.strictEqual(server2?.maxFeeds, 30);
      });
    });
  });

  describe("serverCanUseWebhooks", () => {
    it("returns true when server has valid supporter", async () => {
      const ctx = harness.createContext();
      const serverId = ctx.generateServerId();
      await ctx.createValidSupporter({ guilds: [serverId] });

      const result = await ctx.service.serverCanUseWebhooks(serverId);

      assert.strictEqual(result, true);
    });

    it("returns false when server has expired supporter", async () => {
      const ctx = harness.createContext();
      const serverId = ctx.generateServerId();
      await ctx.createExpiredSupporter({ guilds: [serverId] });

      const result = await ctx.service.serverCanUseWebhooks(serverId);

      assert.strictEqual(result, false);
    });

    it("returns false when server has no supporter", async () => {
      const ctx = harness.createContext();
      const serverId = ctx.generateServerId();

      const result = await ctx.service.serverCanUseWebhooks(serverId);

      assert.strictEqual(result, false);
    });
  });

  describe("getBenefitsFromSupporter", () => {
    it("returns the correct benefits if it is not a valid supporter", () => {
      const ctx = harness.createContext();
      const supporter = ctx.createSupporterObject({
        expireAt: dayjs().subtract(1, "month").toDate(),
        maxFeeds: 10,
        maxGuilds: 5,
      });

      const result = ctx.service.getBenefitsFromSupporter(supporter);

      assert.strictEqual(result.isSupporter, false);
      assert.strictEqual(result.maxFeeds, TEST_DEFAULTS.maxFeeds);
      assert.strictEqual(result.maxUserFeeds, TEST_DEFAULTS.maxUserFeeds);
      assert.strictEqual(result.maxGuilds, 0);
      assert.strictEqual(result.webhooks, false);
      assert.strictEqual(result.refreshRateSeconds, TEST_DEFAULTS.refreshRateSeconds);
      assert.strictEqual(result.allowCustomPlaceholders, false);
      assert.strictEqual(result.dailyArticleLimit, TEST_DEFAULTS.maxDailyArticlesDefault);
    });

    describe("if valid supporter", () => {
      it("returns isSupporter true", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createValidSupporterObject({ maxFeeds: 10, maxGuilds: 5 });

        const result = ctx.service.getBenefitsFromSupporter(supporter);

        assert.strictEqual(result.isSupporter, true);
      });

      it("returns webhooks true", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createValidSupporterObject({ maxFeeds: 10, maxGuilds: 5 });

        const result = ctx.service.getBenefitsFromSupporter(supporter);

        assert.strictEqual(result.webhooks, true);
      });

      it("returns supporter max feeds when larger than default", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createValidSupporterObject({ maxFeeds: 20 });

        const result = ctx.service.getBenefitsFromSupporter(supporter);

        assert.strictEqual(result.maxFeeds, 20);
      });

      it("returns supporter max guilds when larger than default", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createValidSupporterObject({ maxGuilds: 10 });

        const result = ctx.service.getBenefitsFromSupporter(supporter);

        assert.strictEqual(result.maxGuilds, 10);
      });

      it("returns default max guilds of 1 if supporter max guilds does not exist", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createValidSupporterObject({ maxGuilds: undefined });

        const result = ctx.service.getBenefitsFromSupporter(supporter);

        assert.strictEqual(result.maxGuilds, 1);
      });

      it("returns 120 refresh rate if supporter has no patrons and is not slow rate", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createValidSupporterObject({ patrons: [], slowRate: false });

        const result = ctx.service.getBenefitsFromSupporter(supporter);

        assert.strictEqual(result.refreshRateSeconds, 120);
      });

      it("returns default refresh rate if supporter is on slow rate", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createSupporterWithPatronObject({ slowRate: true });

        const result = ctx.service.getBenefitsFromSupporter(supporter);

        assert.strictEqual(result.refreshRateSeconds, TEST_DEFAULTS.refreshRateSeconds);
      });
    });
  });

  describe("isValidSupporter", () => {
    describe("when there are no patrons", () => {
      it("returns false if there is no expiration date and no patrons", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createSupporterObject({ patrons: [], expireAt: undefined });

        const result = ctx.service.isValidSupporter(supporter);

        assert.strictEqual(result, false);
      });

      it("returns true if supporter is not expired yet", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createSupporterObject({
          patrons: [],
          expireAt: dayjs().add(1, "month").toDate(),
        });

        const result = ctx.service.isValidSupporter(supporter);

        assert.strictEqual(result, true);
      });

      it("returns false if supporter is expired", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createSupporterObject({
          patrons: [],
          expireAt: dayjs().subtract(1, "month").toDate(),
        });

        const result = ctx.service.isValidSupporter(supporter);

        assert.strictEqual(result, false);
      });
    });

    describe("when there are patrons", () => {
      it("returns true if there is one active patron with nonzero pledge", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createSupporterObject({
          patrons: [
            { id: ctx.generateId(), status: PatronStatus.ACTIVE, pledge: 1, pledgeLifetime: 100 },
          ],
        });

        const result = ctx.service.isValidSupporter(supporter);

        assert.strictEqual(result, true);
      });

      it("returns true when declined but last charge is within the past 4 days", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createSupporterObject({
          patrons: [
            {
              id: ctx.generateId(),
              status: PatronStatus.DECLINED,
              pledge: 100,
              pledgeLifetime: 100,
              lastCharge: dayjs().subtract(2, "day").toDate(),
            },
          ],
        });

        const result = ctx.service.isValidSupporter(supporter);

        assert.strictEqual(result, true);
      });

      it("returns false when they are a former patron", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createSupporterObject({
          patrons: [
            { id: ctx.generateId(), status: PatronStatus.FORMER, pledge: 0, pledgeLifetime: 100 },
          ],
        });

        const result = ctx.service.isValidSupporter(supporter);

        assert.strictEqual(result, false);
      });

      it("returns false when declined and last charge is >4 days ago", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createSupporterObject({
          patrons: [
            {
              id: ctx.generateId(),
              status: PatronStatus.DECLINED,
              pledge: 0,
              pledgeLifetime: 100,
              lastCharge: dayjs().subtract(5, "day").toDate(),
            },
          ],
        });

        const result = ctx.service.isValidSupporter(supporter);

        assert.strictEqual(result, false);
      });

      it("returns true when there is at least 1 active patron in an array", () => {
        const ctx = harness.createContext();
        const supporter = ctx.createSupporterObject({
          patrons: [
            { id: ctx.generateId(), status: PatronStatus.FORMER, pledge: 0, pledgeLifetime: 100 },
            { id: ctx.generateId(), status: PatronStatus.ACTIVE, pledge: 1, pledgeLifetime: 100 },
          ],
        });

        const result = ctx.service.isValidSupporter(supporter);

        assert.strictEqual(result, true);
      });
    });
  });

  describe("setGuilds", () => {
    it("sets the guilds of the supporter", async () => {
      const ctx = harness.createContext();
      const guildIds = [ctx.generateServerId(), ctx.generateServerId()];
      await ctx.createSupporter({
        guilds: ["old-guild-1", "old-guild-2"],
        maxGuilds: 10,
        maxFeeds: 10,
      });

      await ctx.service.setGuilds(ctx.discordUserId, guildIds);

      const found = await ctx.supporterRepository.findById(ctx.discordUserId);
      assert.deepStrictEqual(found?.guilds, guildIds);
    });

    it("returns the supporter with new guilds", async () => {
      const ctx = harness.createContext();
      const guildIds = [ctx.generateServerId(), ctx.generateServerId()];
      await ctx.createSupporter({
        guilds: ["old-guild-1", "old-guild-2"],
        maxGuilds: 10,
        maxFeeds: 10,
      });

      const result = await ctx.service.setGuilds(ctx.discordUserId, guildIds);

      assert.deepStrictEqual(result?.guilds, guildIds);
    });
  });

  describe("syncDiscordSupporterRoles", () => {
    const rolesConfig = {
      BACKEND_API_SUPPORTER_GUILD_ID: "supporter-guild-id",
      BACKEND_API_SUPPORTER_ROLE_ID: "supporter-role-id",
      BACKEND_API_SUPPORTER_SUBROLE_IDS: "tier1-role,tier2-role,tier3-role",
    };

    it("returns early if supporterGuildId is missing", async () => {
      const ctx = harness.createContext({
        config: { BACKEND_API_SUPPORTER_GUILD_ID: undefined },
      });

      await ctx.service.syncDiscordSupporterRoles(ctx.discordUserId);

      assert.strictEqual(ctx.discordApiService.getGuildMember.mock.callCount(), 0);
    });

    it("returns early if supporterRoleId is missing", async () => {
      const ctx = harness.createContext({
        config: {
          BACKEND_API_SUPPORTER_GUILD_ID: "guild-id",
          BACKEND_API_SUPPORTER_ROLE_ID: undefined,
        },
      });

      await ctx.service.syncDiscordSupporterRoles(ctx.discordUserId);

      assert.strictEqual(ctx.discordApiService.getGuildMember.mock.callCount(), 0);
    });

    it("returns early if supporterSubroleIds is empty", async () => {
      const ctx = harness.createContext({
        config: {
          BACKEND_API_SUPPORTER_GUILD_ID: "guild-id",
          BACKEND_API_SUPPORTER_ROLE_ID: "role-id",
          BACKEND_API_SUPPORTER_SUBROLE_IDS: "",
        },
      });

      await ctx.service.syncDiscordSupporterRoles(ctx.discordUserId);

      assert.strictEqual(ctx.discordApiService.getGuildMember.mock.callCount(), 0);
    });

    it("removes all roles when no subscription", async () => {
      const removedRoles: string[] = [];
      const ctx = harness.createContext({
        config: rolesConfig,
        discordApiService: {
          guildMember: { roles: ["supporter-role-id", "tier1-role"] },
          onRemoveRole: (data) => removedRoles.push(data.roleId),
        },
      });

      await ctx.service.syncDiscordSupporterRoles(ctx.discordUserId);

      assert.ok(removedRoles.includes("supporter-role-id"));
      assert.ok(removedRoles.includes("tier1-role"));
    });

    it("adds base role and tier role when subscription exists", async () => {
      const addedRoles: string[] = [];
      const ctx = harness.createContext({
        config: rolesConfig,
        discordApiService: {
          guildMember: { roles: [] },
          onAddRole: (data) => addedRoles.push(data.roleId),
        },
      });
      await ctx.createSupporterWithSubscription();

      await ctx.service.syncDiscordSupporterRoles(ctx.discordUserId);

      assert.ok(addedRoles.includes("supporter-role-id"));
      assert.ok(addedRoles.includes("tier2-role"));
    });
  });

  describe("getBenefitsOfAllDiscordUsers", () => {
    it("returns empty array when supporters disabled", async () => {
      const ctx = harness.createContext({
        config: { BACKEND_API_ENABLE_SUPPORTERS: false },
      });

      const result = await ctx.service.getBenefitsOfAllDiscordUsers();

      assert.deepStrictEqual(result, []);
    });

    it("returns benefits for all supporters", async () => {
      const ctx = harness.createContext();
      await ctx.createValidSupporter();

      const result = await ctx.service.getBenefitsOfAllDiscordUsers();

      const found = result.find((r) => r.discordUserId === ctx.discordUserId);
      assert.ok(found);
      assert.strictEqual(found.isSupporter, true);
    });

    it("includes non-supporter users with feed limit overrides", async () => {
      const ctx = harness.createContext();
      await ctx.createUserFeedLimitOverride({ additionalUserFeeds: 5 });

      const result = await ctx.service.getBenefitsOfAllDiscordUsers();

      const found = result.find((r) => r.discordUserId === ctx.discordUserId);
      assert.ok(found);
      assert.strictEqual(found.isSupporter, false);
      assert.strictEqual(found.maxUserFeeds, TEST_DEFAULTS.maxUserFeeds + 5);
    });
  });

  describe("getBenefitsOfAllServers", () => {
    it("returns empty array when no guild subscriptions", async () => {
      const ctx = harness.createContext({
        guildSubscriptionsService: { subscriptions: [] },
      });

      const result = await ctx.service.getBenefitsOfAllServers();

      assert.deepStrictEqual(result, []);
    });

    it("returns benefits for servers with guild subscriptions", async () => {
      const ctx = harness.createContext();
      const guildId = ctx.generateServerId();
      await ctx.createValidSupporter({ guilds: [guildId] });
      const mockCtx = harness.createContext({
        guildSubscriptionsService: {
          subscriptions: [
            {
              guildId,
              maxFeeds: 10,
              refreshRateSeconds: 120,
              slowRate: false,
              expireAt: dayjs().add(1, "month").toDate(),
            },
          ],
        },
      });

      const result = await mockCtx.service.getBenefitsOfAllServers();

      const found = result.find((r) => r.serverId === guildId);
      assert.ok(found);
      assert.strictEqual(found.maxFeeds, 10);
    });
  });
});
