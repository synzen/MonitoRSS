import { FeedMongooseRepository } from "../../src/repositories/mongoose/feed.mongoose.repository";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "./test-context";
import { generateTestId } from "./test-id";

export interface FeedTestData {
  title?: string;
  url?: string;
  guild?: string;
  channel?: string;
  addedAt?: Date;
  disabled?: string;
}

export interface FeedRepositoryContext {
  repository: FeedMongooseRepository;
  guildId: string;
  generateId(): string;
  createFeed(
    data?: Partial<FeedTestData>,
  ): Promise<{ id: string; title: string; url: string; guild: string }>;
}

export interface FeedRepositoryHarness {
  setup(): Promise<void>;
  teardown(): Promise<void>;
  createContext(): FeedRepositoryContext;
}

export function createFeedRepositoryHarness(): FeedRepositoryHarness {
  let testContext: ServiceTestContext;
  let repository: FeedMongooseRepository;

  return {
    async setup() {
      testContext = await createServiceTestContext();
      repository = new FeedMongooseRepository(testContext.connection);
    },

    async teardown() {
      await testContext.teardown();
    },

    createContext(): FeedRepositoryContext {
      const testId = generateTestId();
      const guildId = `guild-${testId}`;

      return {
        repository,
        guildId,
        generateId: generateTestId,

        async createFeed(data: Partial<FeedTestData> = {}) {
          const feedId = generateTestId();
          const feed = await repository.create({
            title: data.title ?? `Feed ${feedId}`,
            url: data.url ?? `https://example.com/${feedId}`,
            guild: data.guild ?? guildId,
            channel: data.channel ?? `channel-${testId}`,
            addedAt: data.addedAt ?? new Date(),
            disabled: data.disabled,
          });

          return {
            id: feed.id,
            title: feed.title,
            url: feed.url,
            guild: feed.guild,
          };
        },
      };
    },
  };
}
