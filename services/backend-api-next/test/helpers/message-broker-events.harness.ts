import { mock } from "node:test";
import {
  MessageBrokerEventsService,
  type MessageBrokerEventsServiceDeps,
} from "../../src/services/message-broker-events/message-broker-events.service";
import type { Config } from "../../src/config";
import type { IUserFeedRepository } from "../../src/repositories/interfaces/user-feed.types";
import type { SupportersService } from "../../src/services/supporters/supporters.service";
import type { NotificationsService } from "../../src/services/notifications/notifications.service";
import { generateTestId } from "./test-id";

const DEFAULT_CONFIG = {
  BACKEND_API_ENCRYPTION_KEY_HEX: "test-encryption-key-hex",
} as Config;

export interface UserFeedRepositoryMockOptions {
  updateHealthStatusByFilterResult?: number;
  countWithHealthStatusFilterResult?: number;
  iterateFeedsForDeliveryResult?: AsyncIterable<unknown>;
  iterateFeedsWithLookupKeysForDeliveryResult?: AsyncIterable<unknown>;
  findIdsWithoutDisabledCodeResult?: string[];
  findByIdResult?: unknown;
  disableFeedByIdIfNotDisabledResult?: boolean;
  disableFeedsByFilterIfNotDisabledResult?: number;
}

export interface SupportersServiceMockOptions {
  getBenefitsResult?: {
    allowCustomPlaceholders: boolean;
    allowExternalProperties: boolean;
  };
}

export interface MessageBrokerEventsContextOptions {
  config?: Partial<Config>;
  userFeedRepository?: UserFeedRepositoryMockOptions;
  supportersService?: SupportersServiceMockOptions;
  publishMessageFn?: (
    queue: string,
    message: unknown,
    options?: unknown,
  ) => Promise<void>;
}

export interface MockUserFeedRepository {
  updateHealthStatusByFilter: ReturnType<typeof mock.fn>;
  countWithHealthStatusFilter: ReturnType<typeof mock.fn>;
  iterateFeedsForDelivery: ReturnType<typeof mock.fn>;
  iterateFeedsWithLookupKeysForDelivery: ReturnType<typeof mock.fn>;
  findIdsWithoutDisabledCode: ReturnType<typeof mock.fn>;
  findById: ReturnType<typeof mock.fn>;
  disableFeedsByIds: ReturnType<typeof mock.fn>;
  setConnectionDisabledCode: ReturnType<typeof mock.fn>;
  disableFeedsAndSetHealthStatus: ReturnType<typeof mock.fn>;
  disableFeedByIdIfNotDisabled: ReturnType<typeof mock.fn>;
  disableFeedsByFilterIfNotDisabled: ReturnType<typeof mock.fn>;
}

export interface MockSupportersService {
  syncDiscordSupporterRoles: ReturnType<typeof mock.fn>;
  getBenefitsOfDiscordUser: ReturnType<typeof mock.fn>;
}

export interface MockNotificationsService {
  sendDisabledFeedsAlert: ReturnType<typeof mock.fn>;
  sendDisabledFeedConnectionAlert: ReturnType<typeof mock.fn>;
}

export interface MessageBrokerEventsContext {
  service: MessageBrokerEventsService;
  userFeedRepository: MockUserFeedRepository;
  supportersService: MockSupportersService;
  notificationsService: MockNotificationsService;
  publishMessage: ReturnType<typeof mock.fn>;
  generateId(): string;
}

export interface MessageBrokerEventsHarness {
  createContext(
    options?: MessageBrokerEventsContextOptions,
  ): MessageBrokerEventsContext;
}

function createEmptyAsyncIterable<T>(): AsyncIterable<T> {
  return (async function* () {})();
}

export function createMessageBrokerEventsHarness(): MessageBrokerEventsHarness {
  return {
    createContext(
      options: MessageBrokerEventsContextOptions = {},
    ): MessageBrokerEventsContext {
      const config = { ...DEFAULT_CONFIG, ...options.config } as Config;

      const userFeedRepository: MockUserFeedRepository = {
        updateHealthStatusByFilter: mock.fn(() =>
          Promise.resolve(
            options.userFeedRepository?.updateHealthStatusByFilterResult ?? 1,
          ),
        ),
        countWithHealthStatusFilter: mock.fn(() =>
          Promise.resolve(
            options.userFeedRepository?.countWithHealthStatusFilterResult ?? 0,
          ),
        ),
        iterateFeedsForDelivery: mock.fn(
          () =>
            options.userFeedRepository?.iterateFeedsForDeliveryResult ??
            createEmptyAsyncIterable(),
        ),
        iterateFeedsWithLookupKeysForDelivery: mock.fn(
          () =>
            options.userFeedRepository
              ?.iterateFeedsWithLookupKeysForDeliveryResult ??
            createEmptyAsyncIterable(),
        ),
        findIdsWithoutDisabledCode: mock.fn(() =>
          Promise.resolve(
            options.userFeedRepository?.findIdsWithoutDisabledCodeResult ?? [],
          ),
        ),
        findById: mock.fn(() =>
          Promise.resolve(options.userFeedRepository?.findByIdResult ?? null),
        ),
        disableFeedsByIds: mock.fn(() => Promise.resolve()),
        setConnectionDisabledCode: mock.fn(() => Promise.resolve()),
        disableFeedsAndSetHealthStatus: mock.fn(() => Promise.resolve()),
        disableFeedByIdIfNotDisabled: mock.fn(() =>
          Promise.resolve(
            options.userFeedRepository?.disableFeedByIdIfNotDisabledResult ??
              true,
          ),
        ),
        disableFeedsByFilterIfNotDisabled: mock.fn(() =>
          Promise.resolve(
            options.userFeedRepository
              ?.disableFeedsByFilterIfNotDisabledResult ?? 1,
          ),
        ),
      };

      const supportersService: MockSupportersService = {
        syncDiscordSupporterRoles: mock.fn(() => Promise.resolve()),
        getBenefitsOfDiscordUser: mock.fn(() =>
          Promise.resolve(
            options.supportersService?.getBenefitsResult ?? {
              allowCustomPlaceholders: false,
              allowExternalProperties: false,
            },
          ),
        ),
      };

      const notificationsService: MockNotificationsService = {
        sendDisabledFeedsAlert: mock.fn(() => Promise.resolve()),
        sendDisabledFeedConnectionAlert: mock.fn(() => Promise.resolve()),
      };

      const publishMessage = mock.fn(
        options.publishMessageFn ?? (() => Promise.resolve()),
      );

      const service = new MessageBrokerEventsService({
        config,
        userFeedRepository:
          userFeedRepository as unknown as IUserFeedRepository,
        supportersService: supportersService as unknown as SupportersService,
        notificationsService:
          notificationsService as unknown as NotificationsService,
        publishMessage,
      } as MessageBrokerEventsServiceDeps);

      return {
        service,
        userFeedRepository,
        supportersService,
        notificationsService,
        publishMessage,
        generateId: generateTestId,
      };
    },
  };
}
