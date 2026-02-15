import { mock, type Mock } from "node:test";
import { randomBytes } from "node:crypto";
import { UserFeedMongooseRepository } from "../../src/repositories/mongoose/user-feed.mongoose.repository";
import { UserMongooseRepository } from "../../src/repositories/mongoose/user.mongoose.repository";
import type { IUserFeed } from "../../src/repositories/interfaces/user-feed.types";
import { UserExternalCredentialType } from "../../src/repositories/shared/enums";
import {
  ScheduleHandlerService,
  type ScheduleHandlerServiceDeps,
} from "../../src/services/schedule-handler/schedule-handler.service";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "./test-context";
import { generateTestId } from "./test-id";
import { encrypt } from "../../src/utils/encrypt";

const DEFAULT_REFRESH_RATE_MINUTES = 10;
const DEFAULT_REFRESH_RATE_SECONDS = DEFAULT_REFRESH_RATE_MINUTES * 60;
const DEFAULT_MAX_DAILY_ARTICLES = 100;

export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}

export interface MockSupportersServiceOptions {
  allUserBenefits?: Array<{
    discordUserId: string;
    maxUserFeeds: number;
    maxDailyArticles: number;
    refreshRateSeconds: number;
    isSupporter: boolean;
  }>;
  maxDailyArticlesDefault?: number;
}

export interface MockMessageBrokerService {
  publishUrlFetchBatch: Mock<
    (data: { rateSeconds: number; data: unknown[] }) => Promise<void>
  >;
}

export interface MockUserFeedsService {
  enforceAllUserFeedLimits: Mock<
    (
      limits: Array<{
        discordUserId: string;
        maxUserFeeds: number;
        refreshRateSeconds: number;
      }>,
    ) => Promise<void>
  >;
}

export interface MockUsersService {
  syncLookupKeys: Mock<() => Promise<void>>;
}

export interface ScheduleHandlerContextOptions {
  supportersService?: MockSupportersServiceOptions;
  encryptionKey?: string;
}

export interface CreateFeedWithConnectionInput {
  discordUserId?: string;
  url?: string;
  title?: string;
  refreshRateSeconds?: number;
  userRefreshRateSeconds?: number;
  feedRequestLookupKey?: string;
  slotOffsetMs?: number;
  disabledCode?: string;
  debug?: boolean;
}

export interface ScheduleHandlerContext {
  discordUserId: string;
  encryptionKey?: string;
  service: ScheduleHandlerService;
  userFeedRepository: UserFeedMongooseRepository;
  userRepository: UserMongooseRepository;
  messageBrokerService: MockMessageBrokerService;
  userFeedsService: MockUserFeedsService;
  usersService: MockUsersService;
  generateId(): string;
  createFeed(overrides?: {
    title?: string;
    url?: string;
    refreshRateSeconds?: number;
    userRefreshRateSeconds?: number;
    feedRequestLookupKey?: string;
    slotOffsetMs?: number;
  }): Promise<IUserFeed>;
  createFeedForUser(
    discordUserId: string,
    overrides?: {
      title?: string;
      url?: string;
      refreshRateSeconds?: number;
      userRefreshRateSeconds?: number;
      feedRequestLookupKey?: string;
      slotOffsetMs?: number;
    },
  ): Promise<IUserFeed>;
  createFeedWithConnection(
    input?: CreateFeedWithConnectionInput,
  ): Promise<IUserFeed>;
  createUserWithRedditCredentials(
    discordUserId: string,
    accessToken: string,
  ): Promise<void>;
  setFields(id: string, fields: Record<string, unknown>): Promise<void>;
  findById(id: string): Promise<IUserFeed | null>;
}

export interface ScheduleHandlerHarness {
  setup(): Promise<void>;
  teardown(): Promise<void>;
  createContext(
    options?: ScheduleHandlerContextOptions,
  ): ScheduleHandlerContext;
}

function createMockSupportersService(
  options: MockSupportersServiceOptions = {},
): ScheduleHandlerServiceDeps["supportersService"] {
  const allUserBenefits = options.allUserBenefits ?? [];
  const maxDailyArticlesDefault =
    options.maxDailyArticlesDefault ?? DEFAULT_MAX_DAILY_ARTICLES;

  return {
    maxDailyArticlesDefault,
    defaultMaxUserFeeds: 5,
    defaultRefreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
    defaultSupporterRefreshRateSeconds: 120,
    getBenefitsOfAllDiscordUsers: mock.fn(async () => allUserBenefits),
    getBenefitsOfDiscordUser: mock.fn(async () => ({
      maxUserFeeds: 5,
      maxDailyArticles: DEFAULT_MAX_DAILY_ARTICLES,
      refreshRateSeconds: DEFAULT_REFRESH_RATE_SECONDS,
      isSupporter: false,
    })),
  } as unknown as ScheduleHandlerServiceDeps["supportersService"];
}

function createMockUserFeedsService(): MockUserFeedsService {
  return {
    enforceAllUserFeedLimits: mock.fn(async () => {}),
  };
}

function createMockUsersService(): MockUsersService {
  return {
    syncLookupKeys: mock.fn(async () => {}),
  };
}

function createMockMessageBrokerService(): MockMessageBrokerService {
  return {
    publishUrlFetchBatch: mock.fn(async () => {}),
  };
}

export function createScheduleHandlerHarness(): ScheduleHandlerHarness {
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

    createContext(
      options: ScheduleHandlerContextOptions = {},
    ): ScheduleHandlerContext {
      const discordUserId = generateTestId();
      const messageBrokerService = createMockMessageBrokerService();
      const userFeedsService = createMockUserFeedsService();
      const usersService = createMockUsersService();
      const encryptionKey = options.encryptionKey;

      const serviceDeps: ScheduleHandlerServiceDeps = {
        config: {
          BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES:
            DEFAULT_REFRESH_RATE_MINUTES,
          BACKEND_API_ENCRYPTION_KEY_HEX: encryptionKey,
        } as ScheduleHandlerServiceDeps["config"],
        supportersService: createMockSupportersService(
          options.supportersService,
        ),
        userFeedsService:
          userFeedsService as unknown as ScheduleHandlerServiceDeps["userFeedsService"],
        usersService:
          usersService as unknown as ScheduleHandlerServiceDeps["usersService"],
        userFeedRepository,
        messageBrokerService:
          messageBrokerService as unknown as ScheduleHandlerServiceDeps["messageBrokerService"],
      };

      const service = new ScheduleHandlerService(serviceDeps);

      return {
        discordUserId,
        encryptionKey,
        service,
        userFeedRepository,
        userRepository,
        messageBrokerService,
        userFeedsService,
        usersService,
        generateId: generateTestId,

        async createFeed(overrides = {}) {
          return userFeedRepository.create({
            title: overrides.title ?? "Test Feed",
            url: overrides.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { id: generateTestId(), discordUserId },
            refreshRateSeconds:
              overrides.refreshRateSeconds ?? DEFAULT_REFRESH_RATE_SECONDS,
            userRefreshRateSeconds: overrides.userRefreshRateSeconds,
            feedRequestLookupKey: overrides.feedRequestLookupKey,
            slotOffsetMs: overrides.slotOffsetMs,
          });
        },

        async createFeedForUser(feedDiscordUserId, overrides = {}) {
          return userFeedRepository.create({
            title: overrides.title ?? "Test Feed",
            url: overrides.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { id: generateTestId(), discordUserId: feedDiscordUserId },
            refreshRateSeconds:
              overrides.refreshRateSeconds ?? DEFAULT_REFRESH_RATE_SECONDS,
            userRefreshRateSeconds: overrides.userRefreshRateSeconds,
            feedRequestLookupKey: overrides.feedRequestLookupKey,
            slotOffsetMs: overrides.slotOffsetMs,
          });
        },

        async createFeedWithConnection(
          input: CreateFeedWithConnectionInput = {},
        ) {
          const feedDiscordUserId = input.discordUserId ?? discordUserId;

          const feed = await userFeedRepository.create({
            title: input.title ?? "Test Feed",
            url: input.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { id: generateTestId(), discordUserId: feedDiscordUserId },
            refreshRateSeconds:
              input.refreshRateSeconds ?? DEFAULT_REFRESH_RATE_SECONDS,
            userRefreshRateSeconds: input.userRefreshRateSeconds,
            feedRequestLookupKey: input.feedRequestLookupKey,
            slotOffsetMs: input.slotOffsetMs,
          });

          const updateFields: Record<string, unknown> = {
            "connections.discordChannels": [
              {
                id: generateTestId(),
                name: "Test Channel",
                details: { embeds: [], formatter: {} },
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          };

          if (input.debug !== undefined) {
            updateFields.debug = input.debug;
          }

          await userFeedRepository.updateById(feed.id, {
            $set: updateFields,
          });

          const updatedFeed = await userFeedRepository.findById(feed.id);
          if (!updatedFeed) {
            throw new Error("Feed not found after update");
          }

          return updatedFeed;
        },

        async createUserWithRedditCredentials(
          userDiscordUserId: string,
          accessToken: string,
        ) {
          if (!encryptionKey) {
            throw new Error(
              "encryptionKey must be set in context options to create users with credentials",
            );
          }
          const user = await userRepository.create({
            discordUserId: userDiscordUserId,
          });
          const encryptedToken = encrypt(accessToken, encryptionKey);
          await userRepository.setExternalCredential(user.id, {
            type: UserExternalCredentialType.Reddit,
            data: { accessToken: encryptedToken },
          });
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
