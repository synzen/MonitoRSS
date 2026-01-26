import type { Connection } from "mongoose";
import type { IUserFeed } from "../../src/repositories/interfaces/user-feed.types";
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
  createMockSupportersService,
  createMockUsersService,
  type MockFeedHandlerOptions,
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
  feedHandler?: MockFeedHandlerOptions;
  bannedFeedDetails?: unknown;
  publishMessage?: (queue: string, message: unknown) => Promise<void>;
}

export interface TestContext {
  discordUserId: string;
  userId: string;
  service: UserFeedsService;
  createFeed(overrides?: { title?: string; url?: string }): Promise<IUserFeed>;
  createMany(count: number): Promise<IUserFeed[]>;
  createDisabled(code: UserFeedDisabledCode): Promise<IUserFeed>;
  createSharedFeed(
    ownerDiscordUserId: string,
    status?: UserFeedManagerStatus
  ): Promise<IUserFeed>;
  setDisabledCode(id: string, code: UserFeedDisabledCode | null): Promise<void>;
  setFields(id: string, fields: Record<string, unknown>): Promise<void>;
  findById(id: string): Promise<IUserFeed | null>;
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
      userFeedRepository = new UserFeedMongooseRepository(testContext.connection);
      userRepository = new UserMongooseRepository(testContext.connection);
    },

    async teardown() {
      await testContext.teardown();
    },

    createContext(options: TestContextOptions = {}): TestContext {
      const discordUserId = generateTestId();
      const userId = generateTestId();

      const serviceDeps: UserFeedsServiceDeps = {
        config: {
          BACKEND_API_ENCRYPTION_KEY_HEX: DEFAULT_ENCRYPTION_KEY,
        } as UserFeedsServiceDeps["config"],
        userFeedRepository,
        userRepository,
        feedsService: createMockFeedsService(options.bannedFeedDetails ?? null),
        supportersService: createMockSupportersService({
          maxUserFeeds: options.maxUserFeeds ?? DEFAULT_MAX_USER_FEEDS,
          maxDailyArticles: options.maxDailyArticles ?? DEFAULT_MAX_DAILY_ARTICLES,
          refreshRateSeconds: options.refreshRateSeconds ?? DEFAULT_REFRESH_RATE_SECONDS,
        }),
        feedFetcherApiService: {} as UserFeedsServiceDeps["feedFetcherApiService"],
        feedHandlerService: createMockFeedHandlerService(options.feedHandler),
        usersService: createMockUsersService(userId),
        publishMessage: options.publishMessage ?? (async () => {}),
      };

      const service = new UserFeedsService(serviceDeps);

      return {
        discordUserId,
        userId,
        service,

        generateId: generateTestId,

        async createFeed(overrides = {}) {
          return userFeedRepository.create({
            title: overrides.title ?? "Test Feed",
            url: overrides.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { discordUserId },
          });
        },

        async createMany(count) {
          const feeds: IUserFeed[] = [];
          for (let i = 0; i < count; i++) {
            feeds.push(
              await userFeedRepository.create({
                title: `Feed ${i}`,
                url: `https://example.com/${generateTestId()}.xml`,
                user: { discordUserId },
              })
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

        async createSharedFeed(ownerDiscordUserId, status = UserFeedManagerStatus.Accepted) {
          return userFeedRepository.create({
            title: "Shared Feed",
            url: `https://example.com/${generateTestId()}.xml`,
            user: { discordUserId: ownerDiscordUserId },
            shareManageOptions: {
              invites: [{ discordUserId, status }],
            },
          });
        },

        async setDisabledCode(id, code) {
          if (code === null) {
            await userFeedRepository.updateById(id, { $unset: { disabledCode: 1 } });
          } else {
            await userFeedRepository.updateById(id, { $set: { disabledCode: code } });
          }
        },

        async setFields(id, fields) {
          await userFeedRepository.updateById(id, { $set: fields });
        },

        async findById(id) {
          return userFeedRepository.findById(id);
        },
      };
    },
  };
}
