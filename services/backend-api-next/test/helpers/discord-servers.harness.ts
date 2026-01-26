import { mock } from "node:test";
import { DiscordServersService } from "../../src/services/discord-servers/discord-servers.service";
import type { DiscordServersServiceDeps } from "../../src/services/discord-servers/discord-servers.service";
import type { Config } from "../../src/config";
import { generateTestId } from "./test-id";

const DEFAULT_CONFIG = {
  BACKEND_API_DEFAULT_DATE_FORMAT: "YYYY-MM-DD",
  BACKEND_API_DEFAULT_TIMEZONE: "UTC",
  BACKEND_API_DEFAULT_DATE_LANGUAGE: "en",
} as Config;

export interface DiscordApiServiceMockOptions {
  executeBotRequest?: () => Promise<unknown>;
  getGuild?: () => Promise<unknown>;
  getGuildMember?: () => Promise<unknown>;
}

export interface FeedsServiceMockOptions {
  getServerFeeds?: () => Promise<unknown[]>;
  countServerFeeds?: () => Promise<number>;
}

export interface DiscordPermissionsServiceMockOptions {
  botHasPermissionInServer?: () => Promise<boolean>;
}

export interface DiscordServerProfileRepositoryMockOptions {
  findById?: () => Promise<unknown>;
  findOneAndUpdate?: () => Promise<unknown>;
}

export interface DiscordServersContextOptions {
  config?: Partial<Config>;
  discordApiService?: DiscordApiServiceMockOptions;
  feedsService?: FeedsServiceMockOptions;
  discordPermissionsService?: DiscordPermissionsServiceMockOptions;
  discordServerProfileRepository?: DiscordServerProfileRepositoryMockOptions;
}

export interface MockDiscordApiService {
  executeBotRequest: ReturnType<typeof mock.fn>;
  getGuild: ReturnType<typeof mock.fn>;
  getGuildMember: ReturnType<typeof mock.fn>;
}

export interface MockFeedsService {
  getServerFeeds: ReturnType<typeof mock.fn>;
  countServerFeeds: ReturnType<typeof mock.fn>;
}

export interface MockDiscordPermissionsService {
  botHasPermissionInServer: ReturnType<typeof mock.fn>;
}

export interface MockDiscordServerProfileRepository {
  findById: ReturnType<typeof mock.fn>;
  findOneAndUpdate: ReturnType<typeof mock.fn>;
}

export interface DiscordServersContext {
  service: DiscordServersService;
  discordApiService: MockDiscordApiService;
  feedsService: MockFeedsService;
  discordPermissionsService: MockDiscordPermissionsService;
  discordServerProfileRepository: MockDiscordServerProfileRepository;
  generateId(): string;
  generateServerId(): string;
}

export interface DiscordServersHarness {
  createContext(options?: DiscordServersContextOptions): DiscordServersContext;
}

export function createDiscordServersHarness(): DiscordServersHarness {
  return {
    createContext(options: DiscordServersContextOptions = {}): DiscordServersContext {
      const config = { ...DEFAULT_CONFIG, ...options.config } as Config;

      const discordApiService: MockDiscordApiService = {
        executeBotRequest: mock.fn(
          options.discordApiService?.executeBotRequest ?? (async () => ({}))
        ),
        getGuild: mock.fn(
          options.discordApiService?.getGuild ?? (async () => ({}))
        ),
        getGuildMember: mock.fn(
          options.discordApiService?.getGuildMember ?? (async () => ({}))
        ),
      };

      const feedsService: MockFeedsService = {
        getServerFeeds: mock.fn(
          options.feedsService?.getServerFeeds ?? (async () => [])
        ),
        countServerFeeds: mock.fn(
          options.feedsService?.countServerFeeds ?? (async () => 0)
        ),
      };

      const discordPermissionsService: MockDiscordPermissionsService = {
        botHasPermissionInServer: mock.fn(
          options.discordPermissionsService?.botHasPermissionInServer ?? (async () => true)
        ),
      };

      const discordServerProfileRepository: MockDiscordServerProfileRepository = {
        findById: mock.fn(
          options.discordServerProfileRepository?.findById ?? (async () => null)
        ),
        findOneAndUpdate: mock.fn(
          options.discordServerProfileRepository?.findOneAndUpdate ?? (async () => ({}))
        ),
      };

      const deps = {
        config,
        discordApiService,
        feedsService,
        discordPermissionsService,
        discordServerProfileRepository,
      } as unknown as DiscordServersServiceDeps;

      const service = new DiscordServersService(deps);

      return {
        service,
        discordApiService,
        feedsService,
        discordPermissionsService,
        discordServerProfileRepository,
        generateId: generateTestId,
        generateServerId: generateTestId,
      };
    },
  };
}
