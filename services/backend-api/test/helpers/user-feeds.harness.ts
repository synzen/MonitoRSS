import type { Connection } from "mongoose";
import type { Config } from "../../src/config";
import type {
  IUserFeed,
  WebhookEnforcementTarget,
} from "../../src/repositories/interfaces/user-feed.types";
import type { IDiscordChannelConnection } from "../../src/repositories/interfaces/feed-connection.types";
import { UserFeedMongooseRepository } from "../../src/repositories/mongoose/user-feed.mongoose.repository";
import { UserMongooseRepository } from "../../src/repositories/mongoose/user.mongoose.repository";
import { WorkspaceMongooseRepository } from "../../src/repositories/mongoose/workspace.mongoose.repository";
import { WorkspacesService } from "../../src/features/workspaces/workspaces.service";
import { RedditApiService } from "../../src/services/reddit-api/reddit-api.service";
import type { EmailVerificationService } from "../../src/features/users/email-verification.service";
import {
  UserFeedDisabledCode,
  UserFeedManagerStatus,
} from "../../src/repositories/shared/enums";
import type { UserFeedsServiceDeps } from "../../src/services/user-feeds/types";
import { UserFeedsService } from "../../src/services/user-feeds/user-feeds.service";
import { FeedCredentialsService } from "../../src/services/feed-credentials/feed-credentials.service";
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
  workspaceMaxFeeds?: number;
  workspaceMaxDailyArticles?: number;
  workspaceRefreshRateSeconds?: number;
  workspaceAllowWebhooks?: boolean;
  feedHandler?: MockFeedHandlerOptions;
  feedFetcherService?: MockFeedFetcherServiceOptions;
  feedFetcherApiService?: MockFeedFetcherApiServiceOptions;
  feedConnectionsDiscordChannelsService?: MockFeedConnectionsDiscordChannelsServiceOptions;
  bannedFeedDetails?: unknown;
  publishMessage?: (queue: string, message: unknown) => Promise<void>;
  redditClientId?: string;
  externalCredentials?: Array<{
    type: string;
    status: string;
    data: Record<string, string>;
  }>;
}

export interface CreateFeedWithConnectionsInput {
  discordUserId?: string;
  title?: string;
  url?: string;
  connections?: {
    discordChannels?: Partial<IDiscordChannelConnection>[];
  };
}

export interface CapturedWorkspaceDigest {
  workspaceId: string;
  disabledFeeds: Array<{ id: string; title: string; url: string }>;
}

export interface TestContext {
  discordUserId: string;
  userId: string;
  service: UserFeedsService;
  feedConnectionsDiscordChannelsService: MockFeedConnectionsDiscordChannelsService;
  workspaceDigests: CapturedWorkspaceDigest[];
  createWorkspace(): Promise<{ id: string; slug: string }>;
  createWorkspaceFeed(
    workspaceId: string,
    overrides?: { title?: string; url?: string },
  ): Promise<IUserFeed>;
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
  let workspaceRepository: WorkspaceMongooseRepository;
  let workspacesService: WorkspacesService;

  return {
    async setup() {
      testContext = await createServiceTestContext();
      userFeedRepository = new UserFeedMongooseRepository(
        testContext.connection,
      );
      userRepository = new UserMongooseRepository(testContext.connection);
      workspaceRepository = new WorkspaceMongooseRepository(
        testContext.connection,
      );
      workspacesService = new WorkspacesService({
        // Invitations are not exercised by this feed-authorization harness, so a
        // minimal config and no transport suffice.
        config: {} as Config,
        smtpTransport: null,
        workspaceRepository,
        userRepository,
        userFeedRepository,
        emailVerificationService: {} as EmailVerificationService,
        redditApiService: new RedditApiService({} as Config),
      });
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

      const config = {
        BACKEND_API_ENCRYPTION_KEY_HEX: DEFAULT_ENCRYPTION_KEY,
        BACKEND_API_REDDIT_CLIENT_ID: options.redditClientId,
      } as UserFeedsServiceDeps["config"];

      const usersService = createMockUsersService(
        userId,
        discordUserId,
        options.externalCredentials,
      );

      const workspaceDigests: CapturedWorkspaceDigest[] = [];

      const serviceDeps: UserFeedsServiceDeps = {
        config,
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
          workspaceMaxFeeds: options.workspaceMaxFeeds,
          workspaceMaxDailyArticles: options.workspaceMaxDailyArticles,
          workspaceRefreshRateSeconds: options.workspaceRefreshRateSeconds,
          workspaceAllowWebhooks: options.workspaceAllowWebhooks,
        }),
        feedFetcherApiService: createMockFeedFetcherApiService(
          options.feedFetcherApiService,
        ),
        feedFetcherService: createMockFeedFetcherService(
          options.feedFetcherService,
        ),
        feedHandlerService: createMockFeedHandlerService(options.feedHandler),
        usersService,
        workspacesService,
        feedCredentialsService: new FeedCredentialsService({
          config,
          usersService,
          workspacesService,
        }),
        notificationsService: {
          async sendWorkspaceFeedsDisabledDigest(input) {
            workspaceDigests.push(input);
          },
        },
        publishMessage: options.publishMessage ?? (async () => {}),
        feedConnectionsDiscordChannelsService,
      };

      const service = new UserFeedsService(serviceDeps);

      return {
        discordUserId,
        userId,
        service,
        feedConnectionsDiscordChannelsService,
        workspaceDigests,

        generateId: generateTestId,

        async createWorkspace() {
          const workspace = await workspaceRepository.createWorkspaceWithOwner({
            name: "Test Workspace",
            slug: `test-workspace-${generateTestId()}`,
            ownerUserId: userId,
          });
          return { id: workspace.id, slug: workspace.slug };
        },

        async createWorkspaceFeed(workspaceId, overrides = {}) {
          return userFeedRepository.create({
            title: overrides.title ?? "Workspace Feed",
            url: overrides.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { id: userId, discordUserId },
            workspaceId,
          });
        },

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
