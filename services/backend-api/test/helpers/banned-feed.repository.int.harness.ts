import { BannedFeedMongooseRepository } from "../../src/repositories/mongoose/banned-feed.mongoose.repository";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "./test-context";
import { generateTestId } from "./test-id";

export interface BannedFeedTestData {
  url?: string;
  reason?: string;
  guildIds?: string[];
}

export interface BannedFeedRepositoryContext {
  repository: BannedFeedMongooseRepository;
  guildId: string;
  generateId(): string;
  generateUrl(): string;
  createBannedFeed(
    data?: Partial<BannedFeedTestData>,
  ): Promise<{ id: string; url: string; reason?: string; guildIds: string[] }>;
}

export interface BannedFeedRepositoryHarness {
  setup(): Promise<void>;
  teardown(): Promise<void>;
  createContext(): BannedFeedRepositoryContext;
}

export function createBannedFeedRepositoryHarness(): BannedFeedRepositoryHarness {
  let testContext: ServiceTestContext;
  let repository: BannedFeedMongooseRepository;

  return {
    async setup() {
      testContext = await createServiceTestContext();
      repository = new BannedFeedMongooseRepository(testContext.connection);
    },

    async teardown() {
      await testContext.teardown();
    },

    createContext(): BannedFeedRepositoryContext {
      const testId = generateTestId();
      const guildId = `guild-${testId}`;

      return {
        repository,
        guildId,
        generateId: generateTestId,

        generateUrl() {
          return `https://example-${generateTestId()}.com/feed`;
        },

        async createBannedFeed(data: Partial<BannedFeedTestData> = {}) {
          const feedId = generateTestId();
          const bannedFeed = await repository.create({
            url: data.url ?? `https://banned-${feedId}.com/feed`,
            reason: data.reason,
            guildIds: data.guildIds ?? [guildId],
          });

          return {
            id: bannedFeed.id,
            url: bannedFeed.url,
            reason: bannedFeed.reason,
            guildIds: bannedFeed.guildIds,
          };
        },
      };
    },
  };
}
