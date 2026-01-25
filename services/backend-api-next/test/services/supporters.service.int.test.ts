import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import type { Connection } from "mongoose";
import dayjs from "dayjs";
import {
  setupTestDatabase,
  teardownTestDatabase,
  getTestConnection,
} from "../helpers/setup-test-database";
import { SupportersService } from "../../src/services/supporters/supporters.service";
import { PatronsService } from "../../src/services/patrons/patrons.service";
import { GuildSubscriptionsService } from "../../src/services/guild-subscriptions/guild-subscriptions.service";
import { SupporterMongooseRepository } from "../../src/repositories/mongoose/supporter.mongoose.repository";
import { PatronMongooseRepository } from "../../src/repositories/mongoose/patron.mongoose.repository";
import { UserFeedLimitOverrideMongooseRepository } from "../../src/repositories/mongoose/user-feed-limit-override.mongoose.repository";
import { PatronStatus } from "../../src/repositories/shared/enums";
import { createTestSupporter } from "../helpers/test-data/supporter.test-data";
import { createTestPatron } from "../helpers/test-data/patron.test-data";
import type { Config } from "../../src/config";

describe("SupportersService Integration", { concurrency: false }, () => {
  let mongoConnection: Connection;
  let supportersService: SupportersService;
  let patronsService: PatronsService;
  let guildSubscriptionsService: GuildSubscriptionsService;
  let supporterRepository: SupporterMongooseRepository;
  let patronRepository: PatronMongooseRepository;
  let userFeedLimitOverrideRepository: UserFeedLimitOverrideMongooseRepository;

  const userDiscordId = "user-discord-id";
  const defaultMaxFeeds = 5;
  const defaultMaxUserFeeds = 1000;
  const maxDailyArticlesDefault = 50;
  const maxDailyArticlesSupporter = 500;

  const mockConfig = {
    BACKEND_API_DEFAULT_MAX_FEEDS: defaultMaxFeeds,
    BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES: 10,
    BACKEND_API_DEFAULT_MAX_USER_FEEDS: defaultMaxUserFeeds,
    BACKEND_API_DEFAULT_MAX_SUPPORTER_USER_FEEDS: 1000,
    BACKEND_API_MAX_DAILY_ARTICLES_SUPPORTER: maxDailyArticlesSupporter,
    BACKEND_API_MAX_DAILY_ARTICLES_DEFAULT: maxDailyArticlesDefault,
    BACKEND_API_ENABLE_SUPPORTERS: true,
    BACKEND_API_SUBSCRIPTIONS_ENABLED: false,
  } as Config;

  before(async () => {
    mongoConnection = await setupTestDatabase();

    supporterRepository = new SupporterMongooseRepository(mongoConnection);
    patronRepository = new PatronMongooseRepository(mongoConnection);
    userFeedLimitOverrideRepository = new UserFeedLimitOverrideMongooseRepository(
      mongoConnection
    );

    patronsService = new PatronsService(mockConfig);
    guildSubscriptionsService = new GuildSubscriptionsService(mockConfig);

    supportersService = new SupportersService(
      mockConfig,
      patronsService,
      guildSubscriptionsService,
      undefined,
      supporterRepository,
      userFeedLimitOverrideRepository
    );
  });

  afterEach(async () => {
    await supporterRepository.deleteAll();
    await patronRepository.deleteAll();
    await userFeedLimitOverrideRepository.deleteAll();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  describe("getBenefitsOfDiscordUser", () => {
    it("returns defaults for all values if no supporter is found", async () => {
      const benefits = await supportersService.getBenefitsOfDiscordUser(
        userDiscordId
      );

      assert.strictEqual(benefits.isSupporter, false);
      assert.strictEqual(benefits.maxFeeds, defaultMaxFeeds);
      assert.deepStrictEqual(benefits.guilds, []);
      assert.strictEqual(benefits.maxGuilds, 0);
      assert.deepStrictEqual(benefits.maxUserFeedsComposition, {
        base: defaultMaxUserFeeds,
        legacy: 0,
      });
      assert.strictEqual(benefits.maxDailyArticles, maxDailyArticlesDefault);
      assert.strictEqual(benefits.maxUserFeeds, defaultMaxUserFeeds);
    });

    it("returns the correct benefits", async () => {
      const supporter = createTestSupporter({
        id: userDiscordId,
        expireAt: dayjs().add(1, "day").toDate(),
        maxGuilds: 10,
        maxFeeds: 11,
        guilds: ["1", "2"],
      });

      await supporterRepository.create(supporter);

      const benefits = await supportersService.getBenefitsOfDiscordUser(
        userDiscordId
      );

      assert.strictEqual(benefits.isSupporter, true);
      assert.strictEqual(benefits.maxFeeds, supporter.maxFeeds);
      assert.deepStrictEqual(benefits.guilds, supporter.guilds);
      assert.strictEqual(benefits.maxGuilds, supporter.maxGuilds);
      assert.strictEqual(benefits.refreshRateSeconds, 120);
      assert.strictEqual(benefits.maxDailyArticles, maxDailyArticlesSupporter);
    });
  });

  describe("getBenefitsOfServers", () => {
    const serverId = "server-id";

    it("always returns results for every input server id", async () => {
      const serverIds = ["1", "2", "3"];

      const result = await supportersService.getBenefitsOfServers(serverIds);

      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0]!.hasSupporter, false);
      assert.strictEqual(result[0]!.maxFeeds, defaultMaxFeeds);
      assert.strictEqual(result[0]!.serverId, serverIds[0]);
      assert.strictEqual(result[0]!.webhooks, false);
    });

    describe("when there is no patron", () => {
      it("returns the supporter max feeds if supporter is not expired", async () => {
        const supporter = createTestSupporter({
          id: userDiscordId,
          guilds: [serverId],
          maxFeeds: 10,
          expireAt: dayjs().add(3, "day").toDate(),
        });

        await supporterRepository.create(supporter);

        const result = await supportersService.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, supporter.maxFeeds);
      });

      it("returns the default max feeds if supporter is expired", async () => {
        const supporter = createTestSupporter({
          id: userDiscordId,
          guilds: [serverId],
          maxFeeds: 10,
          expireAt: dayjs().subtract(1, "day").toDate(),
        });

        await supporterRepository.create(supporter);

        const result = await supportersService.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, defaultMaxFeeds);
      });

      it("returns the default max feeds if supporter is not found", async () => {
        const result = await supportersService.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, defaultMaxFeeds);
      });

      it("returns default max feeds if guild supporter has no expire at and no patrons", async () => {
        const supporter = createTestSupporter({
          id: userDiscordId,
          guilds: [serverId],
          maxFeeds: 10,
        });

        await supporterRepository.create(supporter);

        const result = await supportersService.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.maxFeeds, defaultMaxFeeds);
      });

      it("returns webhook and hasSupporter false for a supporter that expired", async () => {
        const supporter = createTestSupporter({
          id: userDiscordId,
          guilds: [serverId],
          maxFeeds: 10,
          expireAt: dayjs().subtract(10, "day").toDate(),
        });

        await supporterRepository.create(supporter);

        const result = await supportersService.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.hasSupporter, false);
        assert.strictEqual(result[0]!.webhooks, false);
      });
    });

    describe("when there is a patron", () => {
      beforeEach(async () => {
        const supporterToInsert = createTestSupporter({
          id: userDiscordId,
          guilds: [serverId],
          maxGuilds: 10,
          maxFeeds: 10,
        });

        await supporterRepository.create(supporterToInsert);
      });

      it("returns hasSupporter: true and webhooks: true", async () => {
        const patronToInsert = createTestPatron({
          discord: userDiscordId,
          status: PatronStatus.ACTIVE,
          pledge: 100,
        });

        await patronRepository.create(patronToInsert);

        const result = await supportersService.getBenefitsOfServers([serverId]);

        assert.strictEqual(result[0]!.hasSupporter, true);
        assert.strictEqual(result[0]!.webhooks, true);
      });

      it("returns the max feeds of an active patron", async () => {
        const patronToInsert = createTestPatron({
          discord: userDiscordId,
          status: PatronStatus.ACTIVE,
          pledge: 100,
        });

        await patronRepository.create(patronToInsert);

        const result = await supportersService.getBenefitsOfServers([serverId]);
        assert.strictEqual(result[0]!.maxFeeds, 10);
      });

      it("returns the max feeds of a declined patron within the grace period", async () => {
        const patronToInsert = createTestPatron({
          discord: userDiscordId,
          status: PatronStatus.DECLINED,
          pledge: 100,
          lastCharge: dayjs().subtract(2, "days").toDate(),
        });

        await patronRepository.create(patronToInsert);

        const result = await supportersService.getBenefitsOfServers([serverId]);
        assert.strictEqual(result[0]!.maxFeeds, 10);
      });

      it("does not return the supporter max feeds of a long-expired declined patron", async () => {
        const patronToInsert = createTestPatron({
          discord: userDiscordId,
          status: PatronStatus.DECLINED,
          pledge: 100,
          lastCharge: dayjs().subtract(6, "days").toDate(),
        });

        await patronRepository.create(patronToInsert);

        const result = await supportersService.getBenefitsOfServers([serverId]);
        assert.strictEqual(result[0]!.maxFeeds, defaultMaxFeeds);
      });

      it("does not return supporter max feeds of a former patron", async () => {
        const patronToInsert = createTestPatron({
          discord: userDiscordId,
          status: PatronStatus.FORMER,
          pledge: 100,
        });

        await patronRepository.create(patronToInsert);

        const result = await supportersService.getBenefitsOfServers([serverId]);
        assert.strictEqual(result[0]!.maxFeeds, defaultMaxFeeds);
      });
    });
  });

  describe("for multiple servers", () => {
    const serverId1 = "server-id-1";
    const serverId2 = "server-id-2";

    it("returns the max feeds correctly", async () => {
      const supportersToInsert = [
        createTestSupporter({
          id: userDiscordId,
          guilds: [serverId1],
          maxGuilds: 10,
          maxFeeds: 10,
          expireAt: dayjs().add(1, "month").toDate(),
        }),
        createTestSupporter({
          id: userDiscordId + "-other",
          guilds: [serverId2],
          maxGuilds: 20,
          maxFeeds: 20,
          expireAt: dayjs().add(1, "month").toDate(),
        }),
      ];

      for (const supporter of supportersToInsert) {
        await supporterRepository.create(supporter);
      }

      const result = await supportersService.getBenefitsOfServers([
        serverId1,
        serverId2,
      ]);

      assert.strictEqual(result.length, 2);
      const server1 = result.find((r) => r.serverId === serverId1);
      const server2 = result.find((r) => r.serverId === serverId2);
      assert.strictEqual(server1?.maxFeeds, supportersToInsert[0]!.maxFeeds);
      assert.strictEqual(server2?.maxFeeds, supportersToInsert[1]!.maxFeeds);
    });

    it("returns webhook for every one", async () => {
      const supportersToInsert = [
        createTestSupporter({
          id: userDiscordId,
          guilds: [serverId1],
          expireAt: dayjs().add(1, "month").toDate(),
        }),
        createTestSupporter({
          id: userDiscordId + "-other",
          guilds: [serverId2],
          expireAt: dayjs().add(1, "month").toDate(),
        }),
      ];

      for (const supporter of supportersToInsert) {
        await supporterRepository.create(supporter);
      }

      const result = await supportersService.getBenefitsOfServers([
        serverId1,
        serverId2,
      ]);

      assert.strictEqual(result.length, 2);
      assert.ok(result.every((r) => r.webhooks));
    });

    it("returns max feeds correctly when a single guild has multiple supporters", async () => {
      const supportersToInsert = [
        createTestSupporter({
          id: userDiscordId,
          guilds: [serverId1],
          maxGuilds: 10,
          maxFeeds: 10,
          expireAt: dayjs().add(1, "month").toDate(),
        }),
        createTestSupporter({
          id: userDiscordId + "-other",
          guilds: [serverId1, serverId2],
          maxGuilds: 20,
          maxFeeds: 20,
          expireAt: dayjs().add(1, "month").toDate(),
        }),
        createTestSupporter({
          id: userDiscordId + "-other-2",
          guilds: [serverId2],
          maxGuilds: 30,
          maxFeeds: 30,
          expireAt: dayjs().add(1, "month").toDate(),
        }),
      ];

      for (const supporter of supportersToInsert) {
        await supporterRepository.create(supporter);
      }

      const result = await supportersService.getBenefitsOfServers([
        serverId1,
        serverId2,
      ]);

      assert.strictEqual(result.length, 2);
      const server1 = result.find((r) => r.serverId === serverId1);
      const server2 = result.find((r) => r.serverId === serverId2);
      assert.strictEqual(server1?.maxFeeds, supportersToInsert[1]!.maxFeeds);
      assert.strictEqual(server2?.maxFeeds, supportersToInsert[2]!.maxFeeds);
    });
  });

  describe("setGuilds", () => {
    it("sets the guilds of the supporter", async () => {
      const guildIds = ["1", "2"];
      const supporterToInsert = createTestSupporter({
        id: userDiscordId,
        guilds: ["old", "guild"],
        maxGuilds: 10,
        maxFeeds: 10,
      });

      await supporterRepository.create(supporterToInsert);

      await supportersService.setGuilds(userDiscordId, guildIds);

      const found = await supporterRepository.findById(userDiscordId);
      assert.deepStrictEqual(found?.guilds, guildIds);
    });

    it("returns the supporter with new guilds", async () => {
      const guildIds = ["1", "2"];
      const supporterToInsert = createTestSupporter({
        id: userDiscordId,
        guilds: ["old", "guild"],
        maxGuilds: 10,
        maxFeeds: 10,
      });

      await supporterRepository.create(supporterToInsert);

      const result = await supportersService.setGuilds(userDiscordId, guildIds);

      assert.deepStrictEqual(result?.guilds, guildIds);
    });
  });

  describe("isValidSupporter", () => {
    describe("when there is no patron", () => {
      it("returns false if there is no expiration date and no patrons", () => {
        const supporter = {
          id: "supporter-id",
          patrons: [],
          guilds: [],
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, false);
      });

      it("returns true if supporter is not expired yet", () => {
        const supporter = {
          id: "supporter-id",
          patrons: [],
          guilds: [],
          expireAt: dayjs().add(1, "month").toDate(),
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, true);
      });

      it("returns false if supporter is expired", () => {
        const supporter = {
          id: "supporter-id",
          patrons: [],
          guilds: [],
          expireAt: dayjs().subtract(1, "month").toDate(),
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, false);
      });
    });

    describe("when there is a patron", () => {
      it("returns true if there is one patron that is active and has a nonzero pledge", () => {
        const supporter = {
          id: "supporter-id",
          guilds: [],
          patrons: [
            {
              id: "patron-1",
              status: PatronStatus.ACTIVE,
              pledge: 1,
              pledgeLifetime: 100,
            },
          ],
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, true);
      });

      it("returns true when declined, but last charge is within the past 4 days", () => {
        const supporter = {
          id: "supporter-id",
          guilds: [],
          patrons: [
            {
              id: "patron-1",
              status: PatronStatus.DECLINED,
              pledge: 100,
              pledgeLifetime: 100,
              lastCharge: dayjs().subtract(2, "day").toDate(),
            },
          ],
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, true);
      });

      it("returns false when they are a former patron", () => {
        const supporter = {
          id: "supporter-id",
          guilds: [],
          patrons: [
            {
              id: "patron-1",
              status: PatronStatus.FORMER,
              pledge: 0,
              pledgeLifetime: 100,
            },
          ],
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, false);
      });

      it("returns false when declined and last charge is >4 days ago", () => {
        const supporter = {
          id: "supporter-id",
          guilds: [],
          patrons: [
            {
              id: "patron-1",
              status: PatronStatus.DECLINED,
              pledge: 0,
              pledgeLifetime: 100,
              lastCharge: dayjs().subtract(5, "day").toDate(),
            },
          ],
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, false);
      });

      it("returns true when there is at least 1 active patron in an array of patrons", () => {
        const supporter = {
          id: "supporter-id",
          guilds: [],
          patrons: [
            {
              id: "patron-1",
              status: PatronStatus.FORMER,
              pledge: 0,
              pledgeLifetime: 100,
            },
            {
              id: "patron-2",
              status: PatronStatus.ACTIVE,
              pledge: 1,
              pledgeLifetime: 100,
            },
          ],
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, true);
      });
    });
  });
});
