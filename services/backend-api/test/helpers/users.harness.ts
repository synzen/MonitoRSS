import { mock } from "node:test";
import { UsersService } from "../../src/services/users/users.service";
import type { Config } from "../../src/config";
import type { IUserRepository } from "../../src/repositories/interfaces/user.types";
import type { IUserFeedRepository } from "../../src/repositories/interfaces/user-feed.types";
import type { ISupporterRepository } from "../../src/repositories/interfaces/supporter.types";
import type { SupportersService } from "../../src/services/supporters/supporters.service";
import type { PaddleService } from "../../src/services/paddle/paddle.service";
import { generateTestId } from "./test-id";

const DEFAULT_CONFIG = {
  BACKEND_API_ENABLE_SUPPORTERS: true,
  BACKEND_API_ENCRYPTION_KEY_HEX: "0".repeat(64),
} as Config;

const DEFAULT_USER = {
  id: "user-id",
  discordUserId: "discord-user-id",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export interface UserRepositoryMockOptions {
  findByEmail?: () => Promise<unknown>;
  findByDiscordId?: () => Promise<unknown>;
  findIdByDiscordId?: () => Promise<string | null>;
  create?: () => Promise<unknown>;
  updateEmailByDiscordId?: () => Promise<unknown>;
  updatePreferencesByDiscordId?: () => Promise<unknown>;
  findEmailsByDiscordIdsWithAlertPreference?: () => Promise<string[]>;
  setExternalCredential?: () => Promise<void>;
  getExternalCredentials?: () => Promise<unknown>;
  removeExternalCredentials?: () => Promise<void>;
  revokeExternalCredential?: () => Promise<void>;
  aggregateUsersWithActiveRedditCredentials?: () => AsyncGenerator<unknown>;
  aggregateUsersWithExpiredOrRevokedRedditCredentials?: () => AsyncGenerator<unknown>;
}

export interface UserFeedRepositoryMockOptions {
  bulkUpdateLookupKeys?: () => Promise<void>;
}

export interface SupporterRepositoryMockOptions {
  findById?: () => Promise<unknown>;
}

export interface SupportersServiceMockOptions {
  getBenefitsOfDiscordUser?: () => Promise<unknown>;
  getSupporterSubscription?: () => Promise<unknown>;
}

export interface PaddleServiceMockOptions {
  updateCustomer?: () => Promise<void> | Promise<never>;
  getCustomerCreditBalanace?: () => Promise<unknown>;
}

export interface UsersContextOptions {
  config?: Partial<Config>;
  userRepository?: UserRepositoryMockOptions;
  userFeedRepository?: UserFeedRepositoryMockOptions;
  supporterRepository?: SupporterRepositoryMockOptions;
  supportersService?: SupportersServiceMockOptions;
  paddleService?: PaddleServiceMockOptions;
}

export interface MockUserRepository {
  findByEmail: ReturnType<typeof mock.fn>;
  findByDiscordId: ReturnType<typeof mock.fn>;
  findIdByDiscordId: ReturnType<typeof mock.fn>;
  create: ReturnType<typeof mock.fn>;
  updateEmailByDiscordId: ReturnType<typeof mock.fn>;
  updatePreferencesByDiscordId: ReturnType<typeof mock.fn>;
  findEmailsByDiscordIdsWithAlertPreference: ReturnType<typeof mock.fn>;
  setExternalCredential: ReturnType<typeof mock.fn>;
  getExternalCredentials: ReturnType<typeof mock.fn>;
  removeExternalCredentials: ReturnType<typeof mock.fn>;
  revokeExternalCredential: ReturnType<typeof mock.fn>;
  aggregateUsersWithActiveRedditCredentials: ReturnType<typeof mock.fn>;
  aggregateUsersWithExpiredOrRevokedRedditCredentials: ReturnType<
    typeof mock.fn
  >;
}

export interface MockUserFeedRepository {
  bulkUpdateLookupKeys: ReturnType<typeof mock.fn>;
}

export interface MockSupporterRepository {
  findById: ReturnType<typeof mock.fn>;
}

export interface MockSupportersService {
  getBenefitsOfDiscordUser: ReturnType<typeof mock.fn>;
  getSupporterSubscription: ReturnType<typeof mock.fn>;
}

export interface MockPaddleService {
  updateCustomer: ReturnType<typeof mock.fn>;
  getCustomerCreditBalanace: ReturnType<typeof mock.fn>;
}

export interface UsersContext {
  service: UsersService;
  userRepository: MockUserRepository;
  userFeedRepository: MockUserFeedRepository;
  supporterRepository: MockSupporterRepository;
  supportersService: MockSupportersService;
  paddleService: MockPaddleService;
  config: Config;
  defaultUser: typeof DEFAULT_USER;
  generateId(): string;
}

export interface UsersHarness {
  createContext(options?: UsersContextOptions): UsersContext;
}

async function* emptyGenerator() {}

export function createUsersHarness(): UsersHarness {
  return {
    createContext(options: UsersContextOptions = {}): UsersContext {
      const config = { ...DEFAULT_CONFIG, ...options.config } as Config;

      const userRepository: MockUserRepository = {
        findByEmail: mock.fn(
          options.userRepository?.findByEmail ??
            (() => Promise.resolve(null)),
        ),
        findByDiscordId: mock.fn(
          options.userRepository?.findByDiscordId ??
            (() => Promise.resolve(null)),
        ),
        findIdByDiscordId: mock.fn(
          options.userRepository?.findIdByDiscordId ??
            (() => Promise.resolve(null)),
        ),
        create: mock.fn(
          options.userRepository?.create ??
            (() => Promise.resolve(DEFAULT_USER)),
        ),
        updateEmailByDiscordId: mock.fn(
          options.userRepository?.updateEmailByDiscordId ??
            (() => Promise.resolve(DEFAULT_USER)),
        ),
        updatePreferencesByDiscordId: mock.fn(
          options.userRepository?.updatePreferencesByDiscordId ??
            (() => Promise.resolve(DEFAULT_USER)),
        ),
        findEmailsByDiscordIdsWithAlertPreference: mock.fn(
          options.userRepository?.findEmailsByDiscordIdsWithAlertPreference ??
            (() => Promise.resolve([])),
        ),
        setExternalCredential: mock.fn(
          options.userRepository?.setExternalCredential ??
            (() => Promise.resolve()),
        ),
        getExternalCredentials: mock.fn(
          options.userRepository?.getExternalCredentials ??
            (() => Promise.resolve(null)),
        ),
        removeExternalCredentials: mock.fn(
          options.userRepository?.removeExternalCredentials ??
            (() => Promise.resolve()),
        ),
        revokeExternalCredential: mock.fn(
          options.userRepository?.revokeExternalCredential ??
            (() => Promise.resolve()),
        ),
        aggregateUsersWithActiveRedditCredentials: mock.fn(
          options.userRepository?.aggregateUsersWithActiveRedditCredentials ??
            emptyGenerator,
        ),
        aggregateUsersWithExpiredOrRevokedRedditCredentials: mock.fn(
          options.userRepository
            ?.aggregateUsersWithExpiredOrRevokedRedditCredentials ??
            emptyGenerator,
        ),
      };

      const userFeedRepository: MockUserFeedRepository = {
        bulkUpdateLookupKeys: mock.fn(
          options.userFeedRepository?.bulkUpdateLookupKeys ??
            (() => Promise.resolve()),
        ),
      };

      const supporterRepository: MockSupporterRepository = {
        findById: mock.fn(
          options.supporterRepository?.findById ??
            (() => Promise.resolve(null)),
        ),
      };

      const supportersService: MockSupportersService = {
        getBenefitsOfDiscordUser: mock.fn(
          options.supportersService?.getBenefitsOfDiscordUser ??
            (() =>
              Promise.resolve({
                maxFeeds: 5,
                maxUserFeeds: 5,
                maxUserFeedsComposition: { base: 5, legacy: 0 },
                allowExternalProperties: false,
                maxPatreonPledge: undefined,
              })),
        ),
        getSupporterSubscription: mock.fn(
          options.supportersService?.getSupporterSubscription ??
            (() => Promise.resolve({ customer: null, subscription: null })),
        ),
      };

      const paddleService: MockPaddleService = {
        updateCustomer: mock.fn(
          options.paddleService?.updateCustomer ?? (() => Promise.resolve()),
        ),
        getCustomerCreditBalanace: mock.fn(
          options.paddleService?.getCustomerCreditBalanace ??
            (() => Promise.resolve({ data: [] })),
        ),
      };

      const service = new UsersService({
        config,
        userRepository: userRepository as unknown as IUserRepository,
        userFeedRepository:
          userFeedRepository as unknown as IUserFeedRepository,
        supporterRepository:
          supporterRepository as unknown as ISupporterRepository,
        supportersService: supportersService as unknown as SupportersService,
        paddleService: paddleService as unknown as PaddleService,
      });

      return {
        service,
        userRepository,
        userFeedRepository,
        supporterRepository,
        supportersService,
        paddleService,
        config,
        defaultUser: DEFAULT_USER,
        generateId: generateTestId,
      };
    },
  };
}
