import { Types, type Connection } from "mongoose";
import type { Config } from "../../src/config";
import type {
  IUserFeed,
  WebhookEnforcementTarget,
} from "../../src/repositories/interfaces/user-feed.types";
import type { IDiscordChannelConnection } from "../../src/repositories/interfaces/feed-connection.types";
import { UserFeedMongooseRepository } from "../../src/repositories/mongoose/user-feed.mongoose.repository";
import { UserMongooseRepository } from "../../src/repositories/mongoose/user.mongoose.repository";
import { SupporterMongooseRepository } from "../../src/repositories/mongoose/supporter.mongoose.repository";
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
import { encrypt } from "../../src/utils/encrypt";
import { generateTestId } from "./test-id";
import { generateEncryptionKey } from "./schedule-handler.harness";

const DEFAULT_MAX_USER_FEEDS = 5;
const DEFAULT_REFRESH_RATE_SECONDS = 600;
const DEFAULT_MAX_DAILY_ARTICLES = 100;
// A real hex key: credentialed reddit fetches decrypt the stored token, so
// the fixture credential must round-trip through encrypt/decrypt.
const DEFAULT_ENCRYPTION_KEY = generateEncryptionKey();

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
  // Billing-enabled posture (hosted instance): supporters + Paddle creds set.
  // Absent keeps the self-host posture where premium-feed gates never fire.
  billingEnabled?: boolean;
  premiumFeedsMinRefreshRateSeconds?: number;
  featureFlags?: { premiumFeeds?: boolean };
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
  // The hex key this context encrypts fixture credentials with; schedule
  // fetch resolution decrypts with the same value.
  encryptionKey: string;
  service: UserFeedsService;
  userFeedRepository: UserFeedMongooseRepository;
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
  setConversionInProgress(workspaceId: string, at?: Date): Promise<void>;
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
  createContext(options?: TestContextOptions): Promise<TestContext>;
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
        supporterRepository: new SupporterMongooseRepository(
          testContext.connection,
        ),
        emailVerificationService: {} as EmailVerificationService,
        redditApiService: new RedditApiService({} as Config),
      });
    },

    async teardown() {
      await testContext.teardown();
    },

    async createContext(options: TestContextOptions = {}): Promise<TestContext> {
      const discordUserId = generateTestId();
      const userId = generateTestId();

      const feedConnectionsDiscordChannelsService =
        createMockFeedConnectionsDiscordChannelsService(
          options.feedConnectionsDiscordChannelsService,
        );

      const config = {
        BACKEND_API_ENCRYPTION_KEY_HEX: DEFAULT_ENCRYPTION_KEY,
        BACKEND_API_REDDIT_CLIENT_ID: options.redditClientId,
        ...(options.billingEnabled
          ? {
              BACKEND_API_ENABLE_SUPPORTERS: true,
              BACKEND_API_PADDLE_KEY: "test-paddle-key",
              BACKEND_API_PADDLE_URL: "https://sandbox.paddle.com",
            }
          : {}),
        BACKEND_API_PREMIUM_FEEDS_MIN_REFRESH_RATE_SECONDS:
          options.premiumFeedsMinRefreshRateSeconds ?? 3600,
      } as UserFeedsServiceDeps["config"];

      const usersService = createMockUsersService(
        userId,
        discordUserId,
        // Default to a connected Reddit grant: the reddit write paths gate on
        // the scope's grant, and the gate tests override this (revoked or
        // empty) to exercise the rejection. The token is encrypted the way
        // production stores it, since fetch resolution decrypts it.
        options.externalCredentials ?? [
          {
            type: "reddit",
            status: "ACTIVE",
            data: {
              accessToken: encrypt(
                "harness-access-token",
                DEFAULT_ENCRYPTION_KEY,
              ),
            },
          },
        ],
        options.featureFlags,
      );

      // Seed the Mongo user document the mock users service claims to back:
      // the schedule sweep resolves reddit fetch credentials from the users
      // collection ($lookup by discordUserId), so the stored grant must
      // mirror the mock's. Revoked/empty overrides seed nothing — the sweep
      // then correctly finds no usable credential.
      const storedCredentials = options.externalCredentials ?? [
        {
          type: "reddit",
          status: "ACTIVE",
          data: {
            accessToken: encrypt("harness-access-token", DEFAULT_ENCRYPTION_KEY),
          },
        },
      ];

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

      if (!options.externalCredentials?.length || options.externalCredentials.some((c) => c.status === "ACTIVE")) {
        const userDoc = await userRepository.create({ discordUserId });
        for (const cred of storedCredentials.filter((c) => c.status === "ACTIVE")) {
          await userRepository.setExternalCredential(userDoc.id, {
            type: cred.type as never,
            data: cred.data,
          });
        }
      }

      const createFeedFor = (
        overrides?: { title?: string; url?: string },
        feedDiscordUserId: string = discordUserId,
      ) =>
        userFeedRepository.create({
          title: overrides?.title ?? "Test Feed",
          url: overrides?.url ?? `https://example.com/${generateTestId()}.xml`,
          user: { id: userId, discordUserId: feedDiscordUserId },
        });

      return {
        discordUserId,
        userId,
        encryptionKey: DEFAULT_ENCRYPTION_KEY,
        service,
        userFeedRepository,
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

        createDisabled: async (code) => {
          const feed = await createFeedFor({
            title: "Test Feed",
            url: `https://example.com/${generateTestId()}.xml`,
          });
          await userFeedRepository.updateById(feed.id, {
            $set: { disabledCode: code },
          });
          return { ...feed, disabledCode: code };
        },

        createDisabledForUser: async (
          feedDiscordUserId: string,
          code: UserFeedDisabledCode,
        ) => {
          const feed = await createFeedFor(
            {
              title: "Test Feed",
              url: `https://example.com/${generateTestId()}.xml`,
            },
            feedDiscordUserId,
          );
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

        async setConversionInProgress(workspaceId, at) {
          // Seed the guard directly so tests can stamp an arbitrary (e.g.
          // expired) timestamp; the production setter is an atomic
          // compare-and-set that only stamps "now".
          await testContext.connection
            .collection("workspaces")
            .updateOne(
              { _id: new Types.ObjectId(workspaceId) },
              { $set: { conversionInProgressAt: at ?? new Date() } },
            );
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
