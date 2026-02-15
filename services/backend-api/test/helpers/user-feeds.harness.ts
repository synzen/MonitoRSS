import type { Connection } from "mongoose";
import type {
  IUserFeed,
  WebhookEnforcementTarget,
} from "../../src/repositories/interfaces/user-feed.types";
import type { IDiscordChannelConnection } from "../../src/repositories/interfaces/feed-connection.types";
import { UserFeedMongooseRepository } from "../../src/repositories/mongoose/user-feed.mongoose.repository";
import { UserMongooseRepository } from "../../src/repositories/mongoose/user.mongoose.repository";
import {
  UserFeedDisabledCode,
  UserFeedManagerStatus,
} from "../../src/repositories/shared/enums";
import type { UserFeedsServiceDeps } from "../../src/services/user-feeds/types";
import { UserFeedsService } from "../../src/services/user-feeds/user-feeds.service";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "./test-context";
import {
  createMockFeedHandlerService,
  createMockFeedsService,
  createMockFeedFetcherService,
  createMockFeedFetcherApiService,
  createMockSupportersService,
  createMockUsersService,
  createMockFeedConnectionsDiscordChannelsService,
  type MockFeedHandlerOptions,
  type MockFeedFetcherServiceOptions,
  type MockFeedFetcherApiServiceOptions,
  type MockFeedConnectionsDiscordChannelsServiceOptions,
  type MockFeedConnectionsDiscordChannelsService,
} from "./mock-factories";
import { generateTestId } from "./test-id";

const DEFAULT_MAX_USER_FEEDS = 5;
const DEFAULT_REFRESH_RATE_SECONDS = 600;
const DEFAULT_MAX_DAILY_ARTICLES = 100;
const DEFAULT_ENCRYPTION_KEY = "test-encryption-key-hex-value-32";

export interface TestContextOptions {
  maxUserFeeds?: number;
  maxDailyArticles?: number;
  refreshRateSeconds?: number;
  isSupporter?: boolean;
  defaultMaxUserFeeds?: number;
  defaultRefreshRateSeconds?: number;
  defaultSupporterRefreshRateSeconds?: number;
  feedHandler?: MockFeedHandlerOptions;
  feedFetcherService?: MockFeedFetcherServiceOptions;
  feedFetcherApiService?: MockFeedFetcherApiServiceOptions;
  feedConnectionsDiscordChannelsService?: MockFeedConnectionsDiscordChannelsServiceOptions;
  bannedFeedDetails?: unknown;
  publishMessage?: (queue: string, message: unknown) => Promise<void>;
}

export interface CreateFeedWithConnectionsInput {
  discordUserId?: string;
  title?: string;
  url?: string;
  connections?: {
    discordChannels?: Partial<IDiscordChannelConnection>[];
  };
}

export interface TestContext {
  discordUserId: string;
  userId: string;
  service: UserFeedsService;
  feedConnectionsDiscordChannelsService: MockFeedConnectionsDiscordChannelsService;
  createFeed(overrides?: { title?: string; url?: string }): Promise<IUserFeed>;
  createFeedForUser(
    discordUserId: string,
    overrides?: { title?: string; url?: string },
  ): Promise<IUserFeed>;
  createFeedWithConnections(
    input: CreateFeedWithConnectionsInput,
  ): Promise<IUserFeed>;
  createMany(count: number): Promise<IUserFeed[]>;
  createDisabled(code: UserFeedDisabledCode): Promise<IUserFeed>;
  createDisabledForUser(
    discordUserId: string,
    code: UserFeedDisabledCode,
  ): Promise<IUserFeed>;
  createSharedFeed(
    ownerDiscordUserId: string,
    status?: UserFeedManagerStatus,
  ): Promise<IUserFeed>;
  setDisabledCode(id: string, code: UserFeedDisabledCode | null): Promise<void>;
  setFields(id: string, fields: Record<string, unknown>): Promise<void>;
  setCreatedAt(id: string, date: Date): Promise<void>;
  findById(id: string): Promise<IUserFeed | null>;
  enforceWebhookConnections(target: WebhookEnforcementTarget): Promise<void>;
  generateId(): string;
}

export interface UserFeedsHarness {
  setup(): Promise<void>;
  teardown(): Promise<void>;
  createContext(options?: TestContextOptions): TestContext;
}

export function createUserFeedsHarness(): UserFeedsHarness {
  let testContext: ServiceTestContext;
  let userFeedRepository: UserFeedMongooseRepository;
  let userRepository: UserMongooseRepository;

  return {
    async setup() {
      testContext = await createServiceTestContext();
      userFeedRepository = new UserFeedMongooseRepository(
        testContext.connection,
      );
      userRepository = new UserMongooseRepository(testContext.connection);
    },

    async teardown() {
      await testContext.teardown();
    },

    createContext(options: TestContextOptions = {}): TestContext {
      const discordUserId = generateTestId();
      const userId = generateTestId();

      const feedConnectionsDiscordChannelsService =
        createMockFeedConnectionsDiscordChannelsService(
          options.feedConnectionsDiscordChannelsService,
        );

      const serviceDeps: UserFeedsServiceDeps = {
        config: {
          BACKEND_API_ENCRYPTION_KEY_HEX: DEFAULT_ENCRYPTION_KEY,
        } as UserFeedsServiceDeps["config"],
        userFeedRepository,
        userRepository,
        feedsService: createMockFeedsService(options.bannedFeedDetails ?? null),
        supportersService: createMockSupportersService({
          maxUserFeeds: options.maxUserFeeds ?? DEFAULT_MAX_USER_FEEDS,
          maxDailyArticles:
            options.maxDailyArticles ?? DEFAULT_MAX_DAILY_ARTICLES,
          refreshRateSeconds:
            options.refreshRateSeconds ?? DEFAULT_REFRESH_RATE_SECONDS,
          isSupporter: options.isSupporter ?? false,
          defaultMaxUserFeeds:
            options.defaultMaxUserFeeds ?? DEFAULT_MAX_USER_FEEDS,
          defaultRefreshRateSeconds:
            options.defaultRefreshRateSeconds ?? DEFAULT_REFRESH_RATE_SECONDS,
          defaultSupporterRefreshRateSeconds:
            options.defaultSupporterRefreshRateSeconds ?? 120,
        }),
        feedFetcherApiService: createMockFeedFetcherApiService(
          options.feedFetcherApiService,
        ),
        feedFetcherService: createMockFeedFetcherService(
          options.feedFetcherService,
        ),
        feedHandlerService: createMockFeedHandlerService(options.feedHandler),
        usersService: createMockUsersService(userId, discordUserId),
        publishMessage: options.publishMessage ?? (async () => {}),
        feedConnectionsDiscordChannelsService,
      };

      const service = new UserFeedsService(serviceDeps);

      return {
        discordUserId,
        userId,
        service,
        feedConnectionsDiscordChannelsService,

        generateId: generateTestId,

        async createFeed(overrides = {}) {
          return userFeedRepository.create({
            title: overrides.title ?? "Test Feed",
            url: overrides.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { id: userId, discordUserId },
          });
        },

        async createFeedForUser(feedDiscordUserId: string, overrides = {}) {
          return userFeedRepository.create({
            title: overrides.title ?? "Test Feed",
            url: overrides.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { id: feedDiscordUserId, discordUserId: feedDiscordUserId },
          });
        },

        async createFeedWithConnections(input: CreateFeedWithConnectionsInput) {
          const feedDiscordUserId = input.discordUserId ?? discordUserId;
          const feed = await userFeedRepository.create({
            title: input.title ?? "Test Feed",
            url: input.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { id: userId, discordUserId: feedDiscordUserId },
          });

          if (input.connections?.discordChannels) {
            await userFeedRepository.updateById(feed.id, {
              $set: {
                "connections.discordChannels":
                  input.connections.discordChannels,
              },
            });
          }

          return userFeedRepository.findById(feed.id) as Promise<IUserFeed>;
        },

        async createMany(count) {
          const feeds: IUserFeed[] = [];
          for (let i = 0; i < count; i++) {
            feeds.push(
              await userFeedRepository.create({
                title: `Feed ${i}`,
                url: `https://example.com/${generateTestId()}.xml`,
                user: { id: userId, discordUserId },
              }),
            );
          }
          return feeds;
        },

        async createDisabled(code) {
          const feed = await this.createFeed({});
          await userFeedRepository.updateById(feed.id, {
            $set: { disabledCode: code },
          });
          return { ...feed, disabledCode: code };
        },

        async createDisabledForUser(
          feedDiscordUserId: string,
          code: UserFeedDisabledCode,
        ) {
          const feed = await this.createFeedForUser(feedDiscordUserId, {});
          await userFeedRepository.updateById(feed.id, {
            $set: { disabledCode: code },
          });
          return { ...feed, disabledCode: code };
        },

        async createSharedFeed(
          ownerDiscordUserId,
          status = UserFeedManagerStatus.Accepted,
        ) {
          return userFeedRepository.create({
            title: "Shared Feed",
            url: `https://example.com/${generateTestId()}.xml`,
            user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
            shareManageOptions: {
              invites: [{ discordUserId, status }],
            },
          });
        },

        async setDisabledCode(id, code) {
          if (code === null) {
            await userFeedRepository.updateById(id, {
              $unset: { disabledCode: 1 },
            });
          } else {
            await userFeedRepository.updateById(id, {
              $set: { disabledCode: code },
            });
          }
        },

        async setFields(id, fields) {
          await userFeedRepository.updateById(id, { $set: fields });
        },

        async setCreatedAt(id, date) {
          await userFeedRepository.updateById(id, {
            $set: { createdAt: date },
          });
        },

        async findById(id) {
          return userFeedRepository.findById(id);
        },

        async enforceWebhookConnections(target) {
          return userFeedRepository.enforceWebhookConnections(target);
        },
      };
    },
  };
}
