import { mock, type Mock } from "node:test";
import type { UserFeedsServiceDeps } from "../../src/services/user-feeds/types";
import type { SupportersServiceDeps } from "../../src/services/supporters/supporters.service";
import type { PatronBenefits } from "../../src/services/patrons/patrons.service";
import { GetArticlesResponseRequestStatus } from "../../src/services/feed-handler/types";
import type { IDiscordChannelConnection } from "../../src/repositories/interfaces/feed-connection.types";
import type { FeedConnectionDisabledCode } from "../../src/repositories/shared/enums";
import { generateTestId } from "./test-id";

export interface MockFeedHandlerOptions {
  url?: string;
  articles?: Array<Record<string, unknown>>;
  feedTitle?: string;
  requestStatus?: GetArticlesResponseRequestStatus;
  getArticlesError?: Error;
}

export function createMockFeedHandlerService(
  options: MockFeedHandlerOptions = {},
): UserFeedsServiceDeps["feedHandlerService"] {
  return {
    getArticles: async () => {
      if (options.getArticlesError) {
        throw options.getArticlesError;
      }
      return {
        requestStatus:
          options.requestStatus ?? GetArticlesResponseRequestStatus.Success,
        url: options.url ?? "https://example.com/feed.xml",
        articles: options.articles ?? [],
        feedTitle: options.feedTitle ?? "Test Feed",
      };
    },
  } as unknown as UserFeedsServiceDeps["feedHandlerService"];
}

export function createMockFeedsService(
  bannedFeedDetails: unknown = null,
): UserFeedsServiceDeps["feedsService"] {
  return {
    getBannedFeedDetails: async () => bannedFeedDetails,
  } as unknown as UserFeedsServiceDeps["feedsService"];
}

export interface MockSupportersOptions {
  maxUserFeeds?: number;
  maxDailyArticles?: number;
  refreshRateSeconds?: number;
  isSupporter?: boolean;
  defaultMaxUserFeeds?: number;
  defaultRefreshRateSeconds?: number;
  defaultSupporterRefreshRateSeconds?: number;
}

export function createMockSupportersService(
  options: MockSupportersOptions = {},
): UserFeedsServiceDeps["supportersService"] {
  return {
    defaultMaxUserFeeds: options.defaultMaxUserFeeds ?? 5,
    defaultRefreshRateSeconds: options.defaultRefreshRateSeconds ?? 600,
    defaultSupporterRefreshRateSeconds:
      options.defaultSupporterRefreshRateSeconds ?? 120,
    getBenefitsOfDiscordUser: async () => ({
      maxUserFeeds: options.maxUserFeeds ?? 5,
      maxDailyArticles: options.maxDailyArticles ?? 100,
      refreshRateSeconds: options.refreshRateSeconds ?? 600,
      isSupporter: options.isSupporter ?? false,
    }),
  } as unknown as UserFeedsServiceDeps["supportersService"];
}

export function createMockUsersService(
  userId?: string,
  discordUserId?: string,
): UserFeedsServiceDeps["usersService"] {
  return {
    getOrCreateUserByDiscordId: async (inputDiscordUserId: string) => ({
      id: userId ?? generateTestId(),
      discordUserId: discordUserId ?? inputDiscordUserId ?? "test-user",
    }),
    syncLookupKeys: async () => {},
  } as unknown as UserFeedsServiceDeps["usersService"];
}

export const DEFAULT_PATRON_BENEFITS: PatronBenefits = {
  existsAndIsValid: true,
  maxFeeds: 10,
  maxUserFeeds: 10,
  allowWebhooks: true,
  maxGuilds: 15,
  refreshRateSeconds: 2,
  allowCustomPlaceholders: true,
  maxPatreonPledge: 500,
};

export interface MockPatronsServiceOptions {
  isValidPatron?: boolean | (() => boolean);
  maxBenefits?: Partial<PatronBenefits>;
}

export interface MockPatronsService {
  isValidPatron: Mock<() => boolean>;
  getMaxBenefitsFromPatrons: Mock<() => PatronBenefits>;
}

export function createMockPatronsService(
  options: MockPatronsServiceOptions = {},
): MockPatronsService {
  const isValidFn =
    typeof options.isValidPatron === "function"
      ? options.isValidPatron
      : () => options.isValidPatron ?? true;

  return {
    isValidPatron: mock.fn(isValidFn),
    getMaxBenefitsFromPatrons: mock.fn(() => ({
      ...DEFAULT_PATRON_BENEFITS,
      ...options.maxBenefits,
    })),
  };
}

export interface MockGuildSubscriptionsServiceOptions {
  subscriptions?: unknown[];
}

export interface MockGuildSubscriptionsService {
  getAllSubscriptions: Mock<() => Promise<unknown[]>>;
}

export function createMockGuildSubscriptionsService(
  options: MockGuildSubscriptionsServiceOptions = {},
): MockGuildSubscriptionsService {
  return {
    getAllSubscriptions: mock.fn(async () => options.subscriptions ?? []),
  };
}

export interface MockDiscordApiServiceOptions {
  guildMember?: { roles: string[] } | null;
  addRoleError?: Error;
  removeRoleError?: Error;
}

export interface MockDiscordApiServiceForSupporters {
  getGuildMember: Mock<() => Promise<{ roles: string[] } | null>>;
  addGuildMemberRole: Mock<() => Promise<void>>;
  removeGuildMemberRole: Mock<() => Promise<void>>;
}

export function createMockDiscordApiServiceForSupporters(
  options: MockDiscordApiServiceOptions = {},
): MockDiscordApiServiceForSupporters {
  return {
    getGuildMember: mock.fn(async () => options.guildMember ?? { roles: [] }),
    addGuildMemberRole: mock.fn(async () => {
      if (options.addRoleError) throw options.addRoleError;
    }),
    removeGuildMemberRole: mock.fn(async () => {
      if (options.removeRoleError) throw options.removeRoleError;
    }),
  };
}

export interface MockSupporterRepositoryOptions {
  findByIdResult?: unknown;
  aggregateWithPatronsResult?: unknown[];
  aggregateSupportersForGuildsResult?: unknown[];
  aggregateAllSupportersWithPatronsResult?: unknown[];
  aggregateAllSupportersWithGuildsResult?: unknown[];
}

export interface MockSupporterRepository {
  findById: Mock<() => Promise<unknown>>;
  findByPaddleEmail: Mock<() => Promise<unknown>>;
  create: Mock<(supporter: unknown) => Promise<unknown>>;
  updateGuilds: Mock<() => Promise<unknown>>;
  deleteAll: Mock<() => Promise<void>>;
  aggregateWithPatronsAndOverrides: Mock<() => Promise<unknown[]>>;
  aggregateSupportersForGuilds: Mock<() => Promise<unknown[]>>;
  aggregateAllSupportersWithPatrons: Mock<() => Promise<unknown[]>>;
  aggregateAllSupportersWithGuilds: Mock<() => Promise<unknown[]>>;
}

export function createMockSupporterRepository(
  options: MockSupporterRepositoryOptions = {},
): MockSupporterRepository {
  return {
    findById: mock.fn(async () => options.findByIdResult ?? null),
    findByPaddleEmail: mock.fn(async () => null),
    create: mock.fn(async (supporter: unknown) => supporter),
    updateGuilds: mock.fn(async () => null),
    deleteAll: mock.fn(async () => {}),
    aggregateWithPatronsAndOverrides: mock.fn(
      async () => options.aggregateWithPatronsResult ?? [],
    ),
    aggregateSupportersForGuilds: mock.fn(
      async () => options.aggregateSupportersForGuildsResult ?? [],
    ),
    aggregateAllSupportersWithPatrons: mock.fn(
      async () => options.aggregateAllSupportersWithPatronsResult ?? [],
    ),
    aggregateAllSupportersWithGuilds: mock.fn(
      async () => options.aggregateAllSupportersWithGuildsResult ?? [],
    ),
  };
}

export interface MockUserFeedLimitOverrideRepositoryOptions {
  findByIdResult?: unknown;
  findByIdsNotInResult?: unknown[];
}

export interface MockUserFeedLimitOverrideRepository {
  findById: Mock<() => Promise<unknown>>;
  findByIdsNotIn: Mock<() => Promise<unknown[]>>;
  deleteAll: Mock<() => Promise<void>>;
}

export function createMockUserFeedLimitOverrideRepository(
  options: MockUserFeedLimitOverrideRepositoryOptions = {},
): MockUserFeedLimitOverrideRepository {
  return {
    findById: mock.fn(async () => options.findByIdResult ?? null),
    findByIdsNotIn: mock.fn(async () => options.findByIdsNotInResult ?? []),
    deleteAll: mock.fn(async () => {}),
  };
}

export interface MockFeedFetcherServiceOptions {
  fetchFeedError?: Error;
}

export function createMockFeedFetcherService(
  options: MockFeedFetcherServiceOptions = {},
): UserFeedsServiceDeps["feedFetcherService"] {
  return {
    fetchFeed: mock.fn(async () => {
      if (options.fetchFeedError) throw options.fetchFeedError;
    }),
  } as unknown as UserFeedsServiceDeps["feedFetcherService"];
}

export interface MockFeedFetcherApiServiceOptions {
  requestStatus?: string;
  statusCode?: number;
}

export function createMockFeedFetcherApiService(
  options: MockFeedFetcherApiServiceOptions = {},
): UserFeedsServiceDeps["feedFetcherApiService"] {
  return {
    fetchAndSave: mock.fn(async () => ({
      requestStatus: options.requestStatus ?? "SUCCESS",
      response: options.statusCode
        ? { statusCode: options.statusCode }
        : undefined,
    })),
  } as unknown as UserFeedsServiceDeps["feedFetcherApiService"];
}

export interface MockDiscordChannelConnectionOptions {
  disabledCode?: FeedConnectionDisabledCode;
  details?: {
    webhook?: {
      id: string;
      guildId: string;
      token: string;
      isApplicationOwned?: boolean;
    };
  };
}

export function createMockDiscordChannelConnection(
  options: MockDiscordChannelConnectionOptions = {},
): Partial<IDiscordChannelConnection> {
  const id = generateTestId();
  return {
    id,
    name: `Connection ${id}`,
    disabledCode: options.disabledCode,
    details: {
      embeds: [],
      formatter: {},
      ...options.details,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Partial<IDiscordChannelConnection>;
}

export interface MockFeedConnectionsDiscordChannelsServiceOptions {
  cloneConnectionIds?: string[];
}

export interface MockFeedConnectionsDiscordChannelsService {
  deleteConnection: Mock<() => Promise<void>>;
  createDiscordChannelConnection: Mock<
    () => Promise<IDiscordChannelConnection>
  >;
  updateDiscordChannelConnection: Mock<
    () => Promise<IDiscordChannelConnection>
  >;
  cloneConnection: Mock<() => Promise<{ ids: string[] }>>;
  copySettings: Mock<() => Promise<void>>;
}

export function createMockFeedConnectionsDiscordChannelsService(
  options: MockFeedConnectionsDiscordChannelsServiceOptions = {},
): MockFeedConnectionsDiscordChannelsService {
  return {
    deleteConnection: mock.fn(async () => {}),
    createDiscordChannelConnection: mock.fn(
      async () => ({}) as IDiscordChannelConnection,
    ),
    updateDiscordChannelConnection: mock.fn(
      async () => ({}) as IDiscordChannelConnection,
    ),
    cloneConnection: mock.fn(async () => ({
      ids: options.cloneConnectionIds ?? [generateTestId()],
    })),
    copySettings: mock.fn(async () => {}),
  };
}
