import { mock, type Mock } from "node:test";
import dayjs from "dayjs";
import type { Config } from "../../src/config";
import type {
  ISupporter,
  SupportPatronAggregateResult,
} from "../../src/repositories/interfaces/supporter.types";
import type { IPatron } from "../../src/repositories/interfaces/patron.types";
import type { IUserFeedLimitOverride } from "../../src/repositories/interfaces/user-feed-limit-override.types";
import { SupportersService } from "../../src/services/supporters/supporters.service";
import { PatronsService } from "../../src/services/patrons/patrons.service";
import { GuildSubscriptionsService } from "../../src/services/guild-subscriptions/guild-subscriptions.service";
import { SupporterMongooseRepository } from "../../src/repositories/mongoose/supporter.mongoose.repository";
import { PatronMongooseRepository } from "../../src/repositories/mongoose/patron.mongoose.repository";
import { UserFeedLimitOverrideMongooseRepository } from "../../src/repositories/mongoose/user-feed-limit-override.mongoose.repository";
import {
  PatronStatus,
  SubscriptionProductKey,
  SubscriptionStatus,
} from "../../src/repositories/shared/enums";
import type { DiscordApiService } from "../../src/services/discord-api/discord-api.service";
import type { GuildSubscriptionFormatted } from "../../src/services/guild-subscriptions/types";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "./test-context";
import { generateTestId } from "./test-id";

const DEFAULT_MAX_FEEDS = 5;
const DEFAULT_MAX_USER_FEEDS = 1000;
const DEFAULT_REFRESH_RATE_MINUTES = 10;
const MAX_DAILY_ARTICLES_DEFAULT = 50;
const MAX_DAILY_ARTICLES_SUPPORTER = 500;

const DEFAULT_CONFIG = {
  BACKEND_API_DEFAULT_MAX_FEEDS: DEFAULT_MAX_FEEDS,
  BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES: DEFAULT_REFRESH_RATE_MINUTES,
  BACKEND_API_DEFAULT_MAX_USER_FEEDS: DEFAULT_MAX_USER_FEEDS,
  BACKEND_API_DEFAULT_MAX_SUPPORTER_USER_FEEDS: 1000,
  BACKEND_API_MAX_DAILY_ARTICLES_SUPPORTER: MAX_DAILY_ARTICLES_SUPPORTER,
  BACKEND_API_MAX_DAILY_ARTICLES_DEFAULT: MAX_DAILY_ARTICLES_DEFAULT,
  BACKEND_API_ENABLE_SUPPORTERS: true,
  BACKEND_API_SUBSCRIPTIONS_ENABLED: false,
} as Config;

export const TEST_DEFAULTS = {
  maxFeeds: DEFAULT_MAX_FEEDS,
  maxUserFeeds: DEFAULT_MAX_USER_FEEDS,
  refreshRateSeconds: DEFAULT_REFRESH_RATE_MINUTES * 60,
  maxDailyArticlesDefault: MAX_DAILY_ARTICLES_DEFAULT,
  maxDailyArticlesSupporter: MAX_DAILY_ARTICLES_SUPPORTER,
};

export interface DiscordApiServiceMockOptions {
  guildMember?: { roles: string[] } | null;
  onAddRole?: (data: {
    guildId: string;
    userId: string;
    roleId: string;
  }) => void;
  onRemoveRole?: (data: {
    guildId: string;
    userId: string;
    roleId: string;
  }) => void;
}

export interface GuildSubscriptionsServiceMockOptions {
  subscriptions?: GuildSubscriptionFormatted[];
}

export interface SupportersContextOptions {
  config?: Partial<Config>;
  discordApiService?: DiscordApiServiceMockOptions;
  guildSubscriptionsService?: GuildSubscriptionsServiceMockOptions;
}

export interface MockDiscordApiService {
  getGuildMember: Mock<() => Promise<{ roles: string[] } | null>>;
  addGuildMemberRole: Mock<
    (data: { guildId: string; userId: string; roleId: string }) => Promise<void>
  >;
  removeGuildMemberRole: Mock<
    (data: { guildId: string; userId: string; roleId: string }) => Promise<void>
  >;
}

export interface SupportersContext {
  discordUserId: string;
  service: SupportersService;
  supporterRepository: SupporterMongooseRepository;
  patronRepository: PatronMongooseRepository;
  userFeedLimitOverrideRepository: UserFeedLimitOverrideMongooseRepository;
  discordApiService: MockDiscordApiService;
  generateId(): string;
  generateServerId(): string;
  createSupporter(overrides?: Partial<ISupporter>): Promise<ISupporter>;
  createValidSupporter(overrides?: Partial<ISupporter>): Promise<ISupporter>;
  createExpiredSupporter(overrides?: Partial<ISupporter>): Promise<ISupporter>;
  createSupporterWithGuild(
    serverId: string,
    overrides?: Partial<ISupporter>,
  ): Promise<ISupporter>;
  createPatron(overrides?: Partial<IPatron>): Promise<IPatron>;
  createActivePatron(overrides?: Partial<IPatron>): Promise<IPatron>;
  createUserFeedLimitOverride(
    overrides?: Partial<IUserFeedLimitOverride>,
  ): Promise<IUserFeedLimitOverride>;
  createSupporterObject(
    overrides?: Partial<SupportPatronAggregateResult>,
  ): SupportPatronAggregateResult;
  createValidSupporterObject(
    overrides?: Partial<SupportPatronAggregateResult>,
  ): SupportPatronAggregateResult;
  createSupporterWithPatronObject(
    overrides?: Partial<SupportPatronAggregateResult>,
  ): SupportPatronAggregateResult;
  createSupporterWithSubscription(
    overrides?: Partial<ISupporter>,
  ): Promise<ISupporter>;
}

export interface SupportersHarness {
  setup(): Promise<void>;
  teardown(): Promise<void>;
  createContext(options?: SupportersContextOptions): SupportersContext;
}

function createMockDiscordApiService(
  options: DiscordApiServiceMockOptions = {},
): MockDiscordApiService {
  return {
    getGuildMember: mock.fn(async () => options.guildMember ?? { roles: [] }),
    addGuildMemberRole: mock.fn(
      async (data: { guildId: string; userId: string; roleId: string }) => {
        options.onAddRole?.(data);
      },
    ),
    removeGuildMemberRole: mock.fn(
      async (data: { guildId: string; userId: string; roleId: string }) => {
        options.onRemoveRole?.(data);
      },
    ),
  };
}

function createMockGuildSubscriptionsService(
  config: Config,
  options: GuildSubscriptionsServiceMockOptions = {},
): GuildSubscriptionsService {
  const service = new GuildSubscriptionsService(config);

  if (options.subscriptions !== undefined) {
    service.getAllSubscriptions = async () => options.subscriptions!;
  }

  return service;
}

export function createSupportersHarness(): SupportersHarness {
  let testContext: ServiceTestContext;
  let supporterRepository: SupporterMongooseRepository;
  let patronRepository: PatronMongooseRepository;
  let userFeedLimitOverrideRepository: UserFeedLimitOverrideMongooseRepository;
  let patronsService: PatronsService;

  return {
    async setup() {
      testContext = await createServiceTestContext();
      supporterRepository = new SupporterMongooseRepository(
        testContext.connection,
      );
      patronRepository = new PatronMongooseRepository(testContext.connection);
      userFeedLimitOverrideRepository =
        new UserFeedLimitOverrideMongooseRepository(testContext.connection);
      patronsService = new PatronsService(DEFAULT_CONFIG);
    },

    async teardown() {
      await testContext.teardown();
    },

    createContext(options: SupportersContextOptions = {}): SupportersContext {
      const discordUserId = generateTestId();
      const config = { ...DEFAULT_CONFIG, ...options.config } as Config;

      const discordApiService = createMockDiscordApiService(
        options.discordApiService,
      );
      const guildSubscriptionsService = createMockGuildSubscriptionsService(
        config,
        options.guildSubscriptionsService,
      );

      const service = new SupportersService({
        config,
        patronsService,
        guildSubscriptionsService,
        discordApiService: discordApiService as unknown as DiscordApiService,
        supporterRepository,
        userFeedLimitOverrideRepository,
      });

      return {
        discordUserId,
        service,
        supporterRepository,
        patronRepository,
        userFeedLimitOverrideRepository,
        discordApiService,
        generateId: generateTestId,
        generateServerId: generateTestId,

        async createSupporter(overrides = {}) {
          const supporter: ISupporter = {
            id: overrides.id ?? discordUserId,
            guilds: overrides.guilds ?? [],
            patron: overrides.patron ?? false,
            ...overrides,
          };
          return supporterRepository.create(supporter);
        },

        async createValidSupporter(overrides = {}) {
          return this.createSupporter({
            expireAt: dayjs().add(1, "month").toDate(),
            ...overrides,
          });
        },

        async createExpiredSupporter(overrides = {}) {
          return this.createSupporter({
            expireAt: dayjs().subtract(1, "month").toDate(),
            ...overrides,
          });
        },

        async createSupporterWithGuild(serverId, overrides = {}) {
          return this.createSupporter({
            guilds: [serverId],
            ...overrides,
          });
        },

        async createSupporterWithSubscription(overrides = {}) {
          return this.createSupporter({
            paddleCustomer: {
              customerId: generateTestId(),
              email: `${generateTestId()}@test.com`,
              lastCurrencyCodeUsed: "USD",
              subscription: {
                id: generateTestId(),
                productKey: SubscriptionProductKey.Tier2,
                status: SubscriptionStatus.Active,
                currencyCode: "USD",
                billingPeriodStart: new Date(),
                billingPeriodEnd: dayjs().add(1, "month").toDate(),
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
            ...overrides,
          });
        },

        async createPatron(overrides = {}) {
          const patron: IPatron = {
            id: generateTestId(),
            discord: overrides.discord ?? discordUserId,
            email: `${generateTestId()}@test.com`,
            name: "Test Patron",
            pledge: overrides.pledge ?? 100,
            pledgeLifetime: overrides.pledgeLifetime ?? 100,
            status: overrides.status ?? PatronStatus.ACTIVE,
            ...overrides,
          };
          return patronRepository.create(patron);
        },

        async createActivePatron(overrides = {}) {
          return this.createPatron({
            status: PatronStatus.ACTIVE,
            pledge: 100,
            ...overrides,
          });
        },

        async createUserFeedLimitOverride(overrides = {}) {
          const override: IUserFeedLimitOverride = {
            id: overrides.id ?? discordUserId,
            additionalUserFeeds: overrides.additionalUserFeeds ?? 5,
            ...overrides,
          };
          return userFeedLimitOverrideRepository.create(override);
        },

        createSupporterObject(overrides = {}) {
          return {
            id: overrides.id ?? generateTestId(),
            patrons: overrides.patrons ?? [],
            guilds: overrides.guilds ?? [],
            ...overrides,
          };
        },

        createValidSupporterObject(overrides = {}) {
          return this.createSupporterObject({
            expireAt: dayjs().add(1, "month").toDate(),
            ...overrides,
          });
        },

        createSupporterWithPatronObject(overrides = {}) {
          return this.createSupporterObject({
            patron: true,
            patrons: [
              {
                id: generateTestId(),
                status: PatronStatus.ACTIVE,
                pledge: 100,
                pledgeLifetime: 100,
              },
            ],
            ...overrides,
          });
        },
      };
    },
  };
}
