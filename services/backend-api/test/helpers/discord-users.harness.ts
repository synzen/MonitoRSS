import { mock } from "node:test";
import { DiscordUsersService } from "../../src/services/discord-users/discord-users.service";
import type { Config } from "../../src/config";
import type { DiscordApiService } from "../../src/services/discord-api/discord-api.service";
import type { SupportersService } from "../../src/services/supporters/supporters.service";
import { generateTestId } from "./test-id";

const DEFAULT_CONFIG = {} as Config;

export interface DiscordApiServiceMockOptions {
  executeBearerRequest?: () => Promise<unknown>;
  getBot?: () => Promise<unknown>;
  executeBotRequest?: () => Promise<unknown>;
}

export interface SupportersServiceMockOptions {
  getBenefitsOfServers?: () => Promise<unknown[]>;
  getBenefitsOfDiscordUser?: () => Promise<unknown>;
  setGuilds?: () => Promise<void>;
}

export interface DiscordUsersContextOptions {
  config?: Partial<Config>;
  discordApiService?: DiscordApiServiceMockOptions;
  supportersService?: SupportersServiceMockOptions;
}

export interface MockDiscordApiService {
  executeBearerRequest: ReturnType<typeof mock.fn>;
  getBot: ReturnType<typeof mock.fn>;
  executeBotRequest: ReturnType<typeof mock.fn>;
}

export interface MockSupportersService {
  getBenefitsOfServers: ReturnType<typeof mock.fn>;
  getBenefitsOfDiscordUser: ReturnType<typeof mock.fn>;
  setGuilds: ReturnType<typeof mock.fn>;
}

export interface DiscordUsersContext {
  service: DiscordUsersService;
  discordApiService: MockDiscordApiService;
  supportersService: MockSupportersService;
  generateId(): string;
}

export interface DiscordUsersHarness {
  createContext(options?: DiscordUsersContextOptions): DiscordUsersContext;
}

export function createDiscordUsersHarness(): DiscordUsersHarness {
  return {
    createContext(
      options: DiscordUsersContextOptions = {},
    ): DiscordUsersContext {
      const config = { ...DEFAULT_CONFIG, ...options.config } as Config;

      const discordApiService: MockDiscordApiService = {
        executeBearerRequest: mock.fn(
          options.discordApiService?.executeBearerRequest ??
            (() => Promise.resolve([])),
        ),
        getBot: mock.fn(
          options.discordApiService?.getBot ?? (() => Promise.resolve({})),
        ),
        executeBotRequest: mock.fn(
          options.discordApiService?.executeBotRequest ??
            (() => Promise.resolve({})),
        ),
      };

      const supportersService: MockSupportersService = {
        getBenefitsOfServers: mock.fn(
          options.supportersService?.getBenefitsOfServers ??
            (() => Promise.resolve([])),
        ),
        getBenefitsOfDiscordUser: mock.fn(
          options.supportersService?.getBenefitsOfDiscordUser ??
            (() =>
              Promise.resolve({
                maxFeeds: 0,
                maxGuilds: 0,
                guilds: [],
                maxUserFeeds: 0,
                maxUserFeedsComposition: { base: 0, legacy: 0 },
              })),
        ),
        setGuilds: mock.fn(
          options.supportersService?.setGuilds ?? (() => Promise.resolve()),
        ),
      };

      const service = new DiscordUsersService({
        config,
        discordApiService: discordApiService as unknown as DiscordApiService,
        supportersService: supportersService as unknown as SupportersService,
      });

      return {
        service,
        discordApiService,
        supportersService,
        generateId: generateTestId,
      };
    },
  };
}
