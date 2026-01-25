import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import dayjs from "dayjs";
import { SupportersService, type SupportersServiceDeps } from "../../src/services/supporters/supporters.service";
import { PatronStatus, SubscriptionProductKey } from "../../src/repositories/shared/enums";
import type { Config } from "../../src/config";
import type { SupportPatronAggregateResult, ISupporterRepository, IUserFeedLimitOverrideRepository } from "../../src/repositories/interfaces";
import type { DiscordApiService } from "../../src/services/discord-api/discord-api.service";

const defaultMaxFeeds = 5;
const defaultMaxUserFeeds = 6;
const defaultRefreshRateSeconds = 60;

const defaultConfig = {
  BACKEND_API_DEFAULT_MAX_FEEDS: defaultMaxFeeds,
  BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES: 1,
  BACKEND_API_DEFAULT_MAX_USER_FEEDS: defaultMaxUserFeeds,
  BACKEND_API_DEFAULT_MAX_SUPPORTER_USER_FEEDS: 1000,
  BACKEND_API_MAX_DAILY_ARTICLES_SUPPORTER: 500,
  BACKEND_API_MAX_DAILY_ARTICLES_DEFAULT: 50,
  BACKEND_API_ENABLE_SUPPORTERS: true,
} as Config;

const defaultDeps: SupportersServiceDeps = {
  config: defaultConfig,
  patronsService: {
    isValidPatron: () => true,
    getMaxBenefitsFromPatrons: () => ({
      existsAndIsValid: true,
      maxFeeds: 10,
      maxUserFeeds: 10,
      allowWebhooks: true,
      maxGuilds: 15,
      refreshRateSeconds: 2,
      allowCustomPlaceholders: true,
      maxPatreonPledge: 500,
    }),
  } as unknown as SupportersServiceDeps["patronsService"],
  guildSubscriptionsService: {
    getAllSubscriptions: async () => [],
  } as unknown as SupportersServiceDeps["guildSubscriptionsService"],
  discordApiService: {
    getGuildMember: async () => ({ roles: [] }),
    addGuildMemberRole: async () => {},
    removeGuildMemberRole: async () => {},
  } as unknown as SupportersServiceDeps["discordApiService"],
  supporterRepository: {
    findById: async () => null,
    findByPaddleEmail: async () => null,
    create: async (supporter: any) => supporter,
    updateGuilds: async () => null,
    deleteAll: async () => {},
    aggregateWithPatronsAndOverrides: async () => [],
    aggregateSupportersForGuilds: async () => [],
    aggregateAllSupportersWithPatrons: async () => [],
    aggregateAllSupportersWithGuilds: async () => [],
  } as unknown as SupportersServiceDeps["supporterRepository"],
  userFeedLimitOverrideRepository: {
    findById: async () => null,
    findByIdsNotIn: async () => [],
    deleteAll: async () => {},
  } as unknown as SupportersServiceDeps["userFeedLimitOverrideRepository"],
};

function createSupportersService(overrides: Partial<SupportersServiceDeps> = {}) {
  const deps: SupportersServiceDeps = {
    ...defaultDeps,
    ...overrides,
    config: { ...defaultConfig, ...overrides.config } as Config,
  };
  return { service: new SupportersService(deps), deps };
}

const mockConfig = defaultConfig;
const mockPatronsService = defaultDeps.patronsService;
const mockGuildSubscriptionsService = defaultDeps.guildSubscriptionsService;
const mockDiscordApiService = defaultDeps.discordApiService;
const mockSupporterRepository = defaultDeps.supporterRepository;
const mockUserFeedLimitOverrideRepository = defaultDeps.userFeedLimitOverrideRepository;

describe("SupportersService", { concurrency: false }, () => {
  let supportersService: SupportersService;

  beforeEach(() => {
    supportersService = createSupportersService().service;
  });

  describe("serverCanUseWebhooks", () => {
    it("returns true correctly", async () => {
      const serverId = "server-id";
      supportersService.getBenefitsOfServers = async () => [
        {
          hasSupporter: true,
          serverId,
          maxFeeds: 10,
          webhooks: true,
          refreshRateSeconds: undefined,
        },
      ];

      const result = await supportersService.serverCanUseWebhooks(serverId);
      assert.strictEqual(result, true);
    });

    it("returns false if the benefits have webhooks false", async () => {
      const serverId = "server-id";
      supportersService.getBenefitsOfServers = async () => [
        {
          hasSupporter: false,
          serverId,
          maxFeeds: 10,
          webhooks: false,
          refreshRateSeconds: undefined,
        },
      ];

      const result = await supportersService.serverCanUseWebhooks(serverId);
      assert.strictEqual(result, false);
    });

    it("returns false if the server has no benefits", async () => {
      const serverId = "server-id";
      supportersService.getBenefitsOfServers = async () => [];

      const result = await supportersService.serverCanUseWebhooks(serverId);
      assert.strictEqual(result, false);
    });
  });

  describe("getBenefitsFromSupporter", () => {
    const supporter: SupportPatronAggregateResult = {
      id: "supporter-id",
      maxFeeds: 10,
      maxGuilds: 5,
      patrons: [],
      guilds: [],
    };

    const patronBenefits = {
      existsAndIsValid: true,
      maxFeeds: 10,
      maxUserFeeds: 10,
      allowWebhooks: true,
      maxGuilds: 15,
      refreshRateSeconds: 2,
      allowCustomPlaceholders: true,
      maxPatreonPledge: 500,
    };

    it("returns the correct benefits if it is not a valid supporter", () => {
      supportersService.isValidSupporter = () => false;

      const result = supportersService.getBenefitsFromSupporter(supporter);

      assert.deepStrictEqual(result, {
        isSupporter: false,
        maxFeeds: defaultMaxFeeds,
        maxUserFeeds: defaultMaxUserFeeds,
        maxUserFeedsComposition: {
          base: defaultMaxUserFeeds,
          legacy: 0,
        },
        maxGuilds: 0,
        webhooks: false,
        refreshRateSeconds: defaultRefreshRateSeconds,
        allowCustomPlaceholders: false,
        dailyArticleLimit: 50,
        allowExternalProperties: false,
      });
    });

    describe("if valid supporter", () => {
      beforeEach(() => {
        supportersService.isValidSupporter = () => true;
        mockPatronsService.getMaxBenefitsFromPatrons = () => patronBenefits;
      });

      it("returns isSupporter true", () => {
        supportersService.isValidSupporter = () => true;

        const result = supportersService.getBenefitsFromSupporter(supporter);

        assert.strictEqual(result.isSupporter, true);
      });

      it("returns webhooks true", () => {
        supportersService.isValidSupporter = () => true;

        const result = supportersService.getBenefitsFromSupporter(supporter);

        assert.strictEqual(result.webhooks, true);
      });

      describe("maxFeeds", () => {
        it("returns the patron max feeds if patron max feeds is larger", () => {
          supportersService.isValidSupporter = () => true;

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxFeeds: patronBenefits.maxFeeds - 5,
          });

          assert.strictEqual(result.maxFeeds, patronBenefits.maxFeeds);
        });

        it("returns the patron max user feeds if patron max user feeds is larger", () => {
          supportersService.isValidSupporter = () => true;

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxFeeds: patronBenefits.maxUserFeeds - 5,
          });

          assert.strictEqual(result.maxFeeds, patronBenefits.maxUserFeeds);
        });

        it("returns the supporter max feeds if supporter max feeds is larger", () => {
          supportersService.isValidSupporter = () => true;
          mockPatronsService.getMaxBenefitsFromPatrons = () => ({
            ...patronBenefits,
            maxFeeds: 10,
            maxUserFeeds: 10,
          });

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxFeeds: patronBenefits.maxFeeds + 5,
          });

          assert.strictEqual(result.maxFeeds, patronBenefits.maxFeeds + 5);
        });

        it("returns the supporter max user feeds if supporter max user feeds is larger", () => {
          supportersService.isValidSupporter = () => true;
          mockPatronsService.getMaxBenefitsFromPatrons = () => ({
            ...patronBenefits,
            maxFeeds: 10,
            maxUserFeeds: 10,
          });

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxUserFeeds: patronBenefits.maxUserFeeds + 5,
          });

          assert.strictEqual(result.maxUserFeeds, patronBenefits.maxUserFeeds + 5);
        });

        it("returns default max feeds if supporter max feeds does not exist and is larger than patron max feeds", () => {
          supportersService.isValidSupporter = () => true;
          mockPatronsService.getMaxBenefitsFromPatrons = () => ({
            ...patronBenefits,
            maxFeeds: defaultMaxFeeds - 10,
            maxUserFeeds: 10,
          });

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxFeeds: undefined,
          });

          assert.strictEqual(result.maxFeeds, defaultMaxFeeds);
        });

        it("returns default max user feeds if supporter max user feeds does not exist and is larger than patron max user feeds", () => {
          supportersService.isValidSupporter = () => true;
          mockPatronsService.getMaxBenefitsFromPatrons = () => ({
            ...patronBenefits,
            maxFeeds: defaultMaxFeeds - 10,
            maxUserFeeds: defaultMaxUserFeeds - defaultMaxUserFeeds - 1,
          });

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxUserFeeds: undefined,
          });

          assert.strictEqual(result.maxUserFeeds, defaultMaxUserFeeds);
        });
      });

      describe("maxGuilds", () => {
        it("returns the patron max guilds if patron max guilds is larger", () => {
          supportersService.isValidSupporter = () => true;
          mockPatronsService.getMaxBenefitsFromPatrons = () => ({
            ...patronBenefits,
            maxFeeds: 5,
            maxGuilds: 10,
          });

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxGuilds: patronBenefits.maxGuilds - 5,
          });

          assert.strictEqual(result.maxGuilds, 10);
        });

        it("returns the supporter max guilds if supporter max guilds is larger", () => {
          supportersService.isValidSupporter = () => true;
          mockPatronsService.getMaxBenefitsFromPatrons = () => ({
            ...patronBenefits,
            maxGuilds: 15,
          });

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxGuilds: patronBenefits.maxGuilds + 5,
          });

          assert.strictEqual(result.maxGuilds, patronBenefits.maxGuilds + 5);
        });

        it("returns default 1 if supporter max guilds does not exist and 1 is larger than patron max guilds", () => {
          supportersService.isValidSupporter = () => true;
          mockPatronsService.getMaxBenefitsFromPatrons = () => ({
            ...patronBenefits,
            maxGuilds: 0,
          });

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            maxGuilds: undefined,
          });

          assert.strictEqual(result.maxGuilds, 1);
        });
      });

      describe("refreshRateSeconds", () => {
        it("returns patron refresh rate if supporter comes from patron rate exists", () => {
          supportersService.isValidSupporter = () => true;
          mockPatronsService.getMaxBenefitsFromPatrons = () => ({
            ...patronBenefits,
            maxFeeds: 5,
            maxGuilds: 10,
            refreshRateSeconds: 1,
          });

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            patron: true,
            patrons: [
              {
                id: "patron-1",
                pledge: 500,
                pledgeLifetime: 100,
                status: PatronStatus.ACTIVE,
              },
            ],
          });

          assert.strictEqual(result.refreshRateSeconds, 1);
        });

        it("returns default refresh rate if supporter is on slow rate", () => {
          supportersService.isValidSupporter = () => true;
          mockPatronsService.getMaxBenefitsFromPatrons = () => ({
            ...patronBenefits,
            refreshRateSeconds: 8,
          });

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            patron: true,
            patrons: [
              {
                id: "patron-1",
                pledge: 500,
                pledgeLifetime: 100,
                status: PatronStatus.ACTIVE,
              },
            ],
            slowRate: true,
          });

          assert.strictEqual(result.refreshRateSeconds, defaultRefreshRateSeconds);
        });

        it("returns 120 if supporter does not have patrons and is not slow rate", () => {
          supportersService.isValidSupporter = () => true;
          mockPatronsService.getMaxBenefitsFromPatrons = () => ({
            ...patronBenefits,
            refreshRateSeconds: undefined,
          });

          const result = supportersService.getBenefitsFromSupporter({
            ...supporter,
            slowRate: false,
            patrons: [],
          });

          assert.strictEqual(result.refreshRateSeconds, 120);
        });
      });
    });
  });

  describe("isValidSupporter", () => {
    describe("when there are no patrons", () => {
      it("returns false if there is no expiration date and no patrons", () => {
        const supporter: SupportPatronAggregateResult = {
          id: "supporter-id",
          patrons: [],
          guilds: [],
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, false);
      });

      it("returns true if supporter is not expired yet", () => {
        const supporter: SupportPatronAggregateResult = {
          id: "supporter-id",
          patrons: [],
          guilds: [],
          expireAt: dayjs().add(1, "month").toDate(),
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, true);
      });

      it("returns false if supporter is expired", () => {
        const supporter: SupportPatronAggregateResult = {
          id: "supporter-id",
          patrons: [],
          guilds: [],
          expireAt: dayjs().subtract(1, "month").toDate(),
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, false);
      });
    });

    describe("when there are patrons", () => {
      it("returns true if some patron is a valid patron", () => {
        const supporter: SupportPatronAggregateResult = {
          id: "supporter-id",
          guilds: [],
          patrons: [
            {
              id: "patron-1",
              status: PatronStatus.ACTIVE,
              pledge: 1,
              pledgeLifetime: 100,
            },
            {
              id: "patron-2",
              status: PatronStatus.FORMER,
              pledge: 0,
              pledgeLifetime: 100,
            },
          ],
        };

        let callCount = 0;
        mockPatronsService.isValidPatron = () => {
          callCount++;
          return callCount === 1;
        };

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, true);
      });

      it("returns false if all patrons are invalid", () => {
        const supporter: SupportPatronAggregateResult = {
          id: "supporter-id",
          guilds: [],
          patrons: [
            {
              id: "patron-1",
              status: PatronStatus.ACTIVE,
              pledge: 1,
              pledgeLifetime: 100,
            },
            {
              id: "patron-2",
              status: PatronStatus.FORMER,
              pledge: 0,
              pledgeLifetime: 100,
            },
          ],
        };

        mockPatronsService.isValidPatron = () => false;

        const result = supportersService.isValidSupporter(supporter);

        assert.strictEqual(result, false);
      });
    });
  });

  describe("syncDiscordSupporterRoles", () => {
    const mockConfigWithRoles = {
      ...mockConfig,
      BACKEND_API_SUPPORTER_GUILD_ID: "supporter-guild-id",
      BACKEND_API_SUPPORTER_ROLE_ID: "supporter-role-id",
      BACKEND_API_SUPPORTER_SUBROLE_IDS: "tier1-role,tier2-role,tier3-role",
    } as Config;

    it("returns early if supporterGuildId is missing", async () => {
      const service = createSupportersService({
        config: { ...mockConfig, BACKEND_API_SUPPORTER_GUILD_ID: undefined } as Config,
        patronsService: mockPatronsService,
        guildSubscriptionsService: mockGuildSubscriptionsService,
        discordApiService: mockDiscordApiService,
        supporterRepository: mockSupporterRepository,
        userFeedLimitOverrideRepository: mockUserFeedLimitOverrideRepository,
      }).service;

      await service.syncDiscordSupporterRoles("user-id");
    });

    it("returns early if supporterRoleId is missing", async () => {
      const service = createSupportersService({
        config: {
          ...mockConfig,
          BACKEND_API_SUPPORTER_GUILD_ID: "guild-id",
          BACKEND_API_SUPPORTER_ROLE_ID: undefined,
        } as Config,
        patronsService: mockPatronsService,
        guildSubscriptionsService: mockGuildSubscriptionsService,
        discordApiService: mockDiscordApiService,
        supporterRepository: mockSupporterRepository,
        userFeedLimitOverrideRepository: mockUserFeedLimitOverrideRepository,
      }).service;

      await service.syncDiscordSupporterRoles("user-id");
    });

    it("returns early if supporterSubroleIds is empty", async () => {
      const service = createSupportersService({
        config: {
          ...mockConfig,
          BACKEND_API_SUPPORTER_GUILD_ID: "guild-id",
          BACKEND_API_SUPPORTER_ROLE_ID: "role-id",
          BACKEND_API_SUPPORTER_SUBROLE_IDS: "",
        } as Config,
        patronsService: mockPatronsService,
        guildSubscriptionsService: mockGuildSubscriptionsService,
        discordApiService: mockDiscordApiService,
        supporterRepository: mockSupporterRepository,
        userFeedLimitOverrideRepository: mockUserFeedLimitOverrideRepository,
      }).service;

      await service.syncDiscordSupporterRoles("user-id");
    });

    it("removes all roles when no subscription", async () => {
      const removedRoles: string[] = [];
      const mockDiscordApiService = {
        getGuildMember: async () => ({
          roles: ["supporter-role-id", "tier1-role"],
        }),
        removeGuildMemberRole: async (data: { roleId: string }) => {
          removedRoles.push(data.roleId);
        },
      } as unknown as DiscordApiService;

      const mockSupporterRepo = {
        ...mockSupporterRepository,
        findById: async () => null,
      } as unknown as ISupporterRepository;

      const service = createSupportersService({
        config: mockConfigWithRoles,
        patronsService: mockPatronsService,
        guildSubscriptionsService: mockGuildSubscriptionsService,
        discordApiService: mockDiscordApiService,
        supporterRepository: mockSupporterRepo,
        userFeedLimitOverrideRepository: mockUserFeedLimitOverrideRepository,
      }).service;

      await service.syncDiscordSupporterRoles("user-id");

      assert.ok(removedRoles.includes("supporter-role-id"));
      assert.ok(removedRoles.includes("tier1-role"));
    });

    it("adds base role and tier role when subscription exists", async () => {
      const addedRoles: string[] = [];
      const mockDiscordApiService = {
        getGuildMember: async () => ({
          roles: [],
        }),
        addGuildMemberRole: async (data: { roleId: string }) => {
          addedRoles.push(data.roleId);
        },
        removeGuildMemberRole: async () => {},
      } as unknown as DiscordApiService;

      const mockSupporterRepo = {
        ...mockSupporterRepository,
        findById: async () => ({
          id: "user-id",
          guilds: [],
          paddleCustomer: {
            customerId: "customer-id",
            email: "test@test.com",
            lastCurrencyCodeUsed: "USD",
            subscription: {
              id: "sub-id",
              productKey: SubscriptionProductKey.Tier2,
              status: "active",
              currencyCode: "USD",
              billingPeriodStart: new Date(),
              billingPeriodEnd: new Date(),
              billingInterval: "month",
              benefits: {
                maxUserFeeds: 10,
                allowWebhooks: true,
                dailyArticleLimit: 500,
                refreshRateSeconds: 120,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
      } as unknown as ISupporterRepository;

      const service = createSupportersService({
        config: mockConfigWithRoles,
        patronsService: mockPatronsService,
        guildSubscriptionsService: mockGuildSubscriptionsService,
        discordApiService: mockDiscordApiService,
        supporterRepository: mockSupporterRepo,
        userFeedLimitOverrideRepository: mockUserFeedLimitOverrideRepository,
      }).service;

      await service.syncDiscordSupporterRoles("user-id");

      assert.ok(addedRoles.includes("supporter-role-id"));
      assert.ok(addedRoles.includes("tier2-role"));
    });
  });

  describe("getBenefitsOfAllDiscordUsers", () => {
    it("returns empty array when supporters disabled", async () => {
      const service = createSupportersService({
        config: { ...mockConfig, BACKEND_API_ENABLE_SUPPORTERS: false } as Config,
        patronsService: mockPatronsService,
        guildSubscriptionsService: mockGuildSubscriptionsService,
        discordApiService: mockDiscordApiService,
        supporterRepository: mockSupporterRepository,
        userFeedLimitOverrideRepository: mockUserFeedLimitOverrideRepository,
      }).service;

      const result = await service.getBenefitsOfAllDiscordUsers();

      assert.deepStrictEqual(result, []);
    });

    it("returns benefits for all supporters", async () => {
      const mockSupporterRepo = {
        aggregateAllSupportersWithPatrons: async () => [
          {
            id: "supporter-1",
            guilds: [],
            patrons: [],
            expireAt: dayjs().add(1, "month").toDate(),
          },
        ],
      } as unknown as ISupporterRepository;

      const mockOverrideRepo = {
        findByIdsNotIn: async () => [],
      } as unknown as IUserFeedLimitOverrideRepository;

      const service = createSupportersService({
        config: mockConfig,
        patronsService: mockPatronsService,
        guildSubscriptionsService: mockGuildSubscriptionsService,
        discordApiService: mockDiscordApiService,
        supporterRepository: mockSupporterRepo,
        userFeedLimitOverrideRepository: mockOverrideRepo,
      }).service;

      const result = await service.getBenefitsOfAllDiscordUsers();

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.discordUserId, "supporter-1");
    });

    it("includes non-supporter users with feed limit overrides", async () => {
      const mockSupporterRepo = {
        aggregateAllSupportersWithPatrons: async () => [],
      } as unknown as ISupporterRepository;

      const mockOverrideRepo = {
        findByIdsNotIn: async () => [
          { id: "non-supporter-1", additionalUserFeeds: 5 },
        ],
      } as unknown as IUserFeedLimitOverrideRepository;

      const service = createSupportersService({
        config: mockConfig,
        patronsService: mockPatronsService,
        guildSubscriptionsService: mockGuildSubscriptionsService,
        discordApiService: mockDiscordApiService,
        supporterRepository: mockSupporterRepo,
        userFeedLimitOverrideRepository: mockOverrideRepo,
      }).service;

      const result = await service.getBenefitsOfAllDiscordUsers();

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.discordUserId, "non-supporter-1");
      assert.strictEqual(result[0]?.isSupporter, false);
      assert.strictEqual(result[0]?.maxUserFeeds, defaultMaxUserFeeds + 5);
    });
  });

  describe("getBenefitsOfAllServers", () => {
    it("returns empty array when no guild subscriptions", async () => {
      const service = createSupportersService({
        config: mockConfig,
        patronsService: mockPatronsService,
        guildSubscriptionsService: mockGuildSubscriptionsService,
        discordApiService: mockDiscordApiService,
        supporterRepository: mockSupporterRepository,
        userFeedLimitOverrideRepository: mockUserFeedLimitOverrideRepository,
      }).service;

      const result = await service.getBenefitsOfAllServers();

      assert.deepStrictEqual(result, []);
    });

    it("returns correct benefits for servers with supporters", async () => {
      mockGuildSubscriptionsService.getAllSubscriptions = async () => [
        { guildId: "guild-1", maxFeeds: 10, refreshRate: 120 },
      ] as never;

      const mockSupporterRepo = {
        aggregateAllSupportersWithGuilds: async () => [
          {
            id: "supporter-1",
            guildId: "guild-1",
            patrons: [],
            expireAt: dayjs().add(1, "month").toDate(),
          },
        ],
      } as unknown as ISupporterRepository;

      const service = createSupportersService({
        config: mockConfig,
        patronsService: mockPatronsService,
        guildSubscriptionsService: mockGuildSubscriptionsService,
        discordApiService: mockDiscordApiService,
        supporterRepository: mockSupporterRepo,
        userFeedLimitOverrideRepository: mockUserFeedLimitOverrideRepository,
      }).service;

      const result = await service.getBenefitsOfAllServers();

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.serverId, "guild-1");
    });
  });
});
