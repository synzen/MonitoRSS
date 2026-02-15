import type { IUserFeed } from "../../src/repositories/interfaces/user-feed.types";
import { UserFeedMongooseRepository } from "../../src/repositories/mongoose/user-feed.mongoose.repository";
import {
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../../src/repositories/shared/enums";
import type { UserFeedManagementInvitesServiceDeps } from "../../src/services/user-feed-management-invites/types";
import { UserFeedManagementInvitesService } from "../../src/services/user-feed-management-invites/user-feed-management-invites.service";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "./test-context";
import {
  createMockSupportersService,
  type MockSupportersOptions,
} from "./mock-factories";
import { generateTestId } from "./test-id";

export interface TestContextOptions extends MockSupportersOptions {}

export interface CreateFeedWithInviteInput {
  ownerDiscordUserId?: string;
  inviteeDiscordUserId?: string;
  inviteStatus?: UserFeedManagerStatus;
  inviteType?: UserFeedManagerInviteType;
  connections?: Array<{ connectionId: string }>;
  title?: string;
  url?: string;
}

export interface CreateFeedWithConnectionInput {
  title?: string;
  url?: string;
}

export interface TestContext {
  discordUserId: string;
  service: UserFeedManagementInvitesService;
  repository: UserFeedMongooseRepository;
  createFeed(overrides?: { title?: string; url?: string }): Promise<IUserFeed>;
  createFeedForUser(
    discordUserId: string,
    overrides?: { title?: string; url?: string },
  ): Promise<IUserFeed>;
  createFeedWithConnection(input?: CreateFeedWithConnectionInput): Promise<{
    feed: IUserFeed;
    connectionId: string;
  }>;
  createFeedWithInvite(input?: CreateFeedWithInviteInput): Promise<{
    feed: IUserFeed;
    inviteId: string;
    inviteeDiscordUserId: string;
  }>;
  findById(id: string): Promise<IUserFeed | null>;
  generateId(): string;
  getInviteFromFeed(
    feedId: string,
    inviteId: string,
  ): Promise<IUserFeed["shareManageOptions"]>;
}

export interface UserFeedManagementInvitesHarness {
  setup(): Promise<void>;
  teardown(): Promise<void>;
  createContext(options?: TestContextOptions): TestContext;
}

function createMockUserFeedsService(currentFeedCount: number = 0) {
  return {
    calculateCurrentFeedCountOfDiscordUser: async () => currentFeedCount,
  };
}

export function createUserFeedManagementInvitesHarness(): UserFeedManagementInvitesHarness {
  let testContext: ServiceTestContext;
  let userFeedRepository: UserFeedMongooseRepository;

  return {
    async setup() {
      testContext = await createServiceTestContext();
      userFeedRepository = new UserFeedMongooseRepository(
        testContext.connection,
      );
    },

    async teardown() {
      await testContext.teardown();
    },

    createContext(options: TestContextOptions = {}): TestContext {
      const discordUserId = generateTestId();

      const serviceDeps: UserFeedManagementInvitesServiceDeps = {
        userFeedRepository,
        userFeedsService: createMockUserFeedsService(
          0,
        ) as unknown as UserFeedManagementInvitesServiceDeps["userFeedsService"],
        supportersService: createMockSupportersService({
          maxUserFeeds: options.maxUserFeeds ?? 100,
          ...options,
        }) as unknown as UserFeedManagementInvitesServiceDeps["supportersService"],
      };

      const service = new UserFeedManagementInvitesService(serviceDeps);

      return {
        discordUserId,
        service,
        repository: userFeedRepository,

        generateId: generateTestId,

        async createFeed(overrides = {}) {
          return userFeedRepository.create({
            title: overrides.title ?? "Test Feed",
            url: overrides.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { id: generateTestId(), discordUserId },
          });
        },

        async createFeedForUser(feedDiscordUserId: string, overrides = {}) {
          return userFeedRepository.create({
            title: overrides.title ?? "Test Feed",
            url: overrides.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { id: generateTestId(), discordUserId: feedDiscordUserId },
          });
        },

        async createFeedWithConnection(
          input: CreateFeedWithConnectionInput = {},
        ) {
          const connectionId = generateTestId();
          const feed = await userFeedRepository.create({
            title: input.title ?? "Test Feed",
            url: input.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { id: generateTestId(), discordUserId },
            connections: {
              discordChannels: [
                {
                  id: connectionId,
                  name: "Test Connection",
                  details: {
                    embeds: [],
                    formatter: {},
                  },
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ],
            },
          });

          return { feed, connectionId };
        },

        async createFeedWithInvite(input: CreateFeedWithInviteInput = {}) {
          const ownerDiscordUserId =
            input.ownerDiscordUserId ?? generateTestId();
          const inviteeDiscordUserId =
            input.inviteeDiscordUserId ?? generateTestId();

          const feed = await userFeedRepository.create({
            title: input.title ?? "Test Feed",
            url: input.url ?? `https://example.com/${generateTestId()}.xml`,
            user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
            shareManageOptions: {
              invites: [
                {
                  discordUserId: inviteeDiscordUserId,
                  type: input.inviteType,
                  status: input.inviteStatus ?? UserFeedManagerStatus.Pending,
                  connections: input.connections,
                },
              ],
            },
          });

          const inviteId = feed.shareManageOptions!.invites[0]!.id;

          return {
            feed,
            inviteId,
            inviteeDiscordUserId,
          };
        },

        async findById(id) {
          return userFeedRepository.findById(id);
        },

        async getInviteFromFeed(feedId: string) {
          const feed = await userFeedRepository.findById(feedId);
          return feed?.shareManageOptions;
        },
      };
    },
  };
}
