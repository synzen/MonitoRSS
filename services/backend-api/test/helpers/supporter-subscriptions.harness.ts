import { mock, type Mock } from "node:test";
import type { Config } from "../../src/config";
import { UserMongooseRepository } from "../../src/repositories/mongoose/user.mongoose.repository";
import { SupporterSubscriptionsService } from "../../src/services/supporter-subscriptions/supporter-subscriptions.service";
import type { PaddleService } from "../../src/services/paddle/paddle.service";
import type { SupportersService } from "../../src/services/supporters/supporters.service";
import type { MessageBrokerService } from "../../src/services/message-broker/message-broker.service";
import type { IUser } from "../../src/repositories/interfaces/user.types";
import type {
  PaddlePricingPreviewResponse,
  PaddleSubscriptionPreviewResponse,
  PaddleSubscriptionUpdatePaymentMethodResponse,
} from "../../src/services/supporter-subscriptions/types";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "./test-context";
import { generateTestId } from "./test-id";

const DEFAULT_CONFIG = {
  BACKEND_API_PADDLE_KEY: "test-paddle-key",
  BACKEND_API_PADDLE_URL: "https://sandbox-api.paddle.com",
} as Config;

export interface MockPaddleService {
  getProducts: Mock<
    () => Promise<{
      products: Array<{
        id: string;
        name: string;
        prices: Array<{
          id: string;
          billingCycle: {
            interval: "month" | "year";
            frequency: number;
          } | null;
        }>;
        customData?: { key?: string };
      }>;
    }>
  >;
  executeApiCall: Mock<<T>(endpoint: string, data?: RequestInit) => Promise<T>>;
}

export interface MockSupportersService {
  getSupporterSubscription: Mock<
    (params: { discordUserId?: string; billingEmail?: string }) => Promise<{
      discordUserId?: string;
      customer: { id: string; currencyCode: string } | null;
      subscription: {
        id: string;
        currencyCode: string;
        updatedAt: Date;
        cancellationDate?: Date | null;
      } | null;
    }>
  >;
}

export interface MockMessageBrokerService {
  publishSyncSupporterDiscordRoles: Mock<
    (data: { userId: string }) => Promise<void>
  >;
}

export interface SupporterSubscriptionsContextOptions {
  config?: Partial<Config>;
  paddleService?: {
    getProducts?: () => Promise<{
      products: Array<{
        id: string;
        name: string;
        prices: Array<{
          id: string;
          billingCycle: {
            interval: "month" | "year";
            frequency: number;
          } | null;
        }>;
        customData?: { key?: string };
      }>;
    }>;
    executeApiCall?: <T>(endpoint: string, data?: RequestInit) => Promise<T>;
  };
  supportersService?: {
    getSupporterSubscription?: (params: {
      discordUserId?: string;
      billingEmail?: string;
    }) => Promise<{
      discordUserId?: string;
      customer: { id: string; currencyCode: string } | null;
      subscription: {
        id: string;
        currencyCode: string;
        updatedAt: Date;
        cancellationDate?: Date | null;
      } | null;
    }>;
  };
  messageBrokerService?: {
    publishSyncSupporterDiscordRoles?: (data: {
      userId: string;
    }) => Promise<void>;
  };
}

export interface SupporterSubscriptionsContext {
  service: SupporterSubscriptionsService;
  userRepository: UserMongooseRepository;
  paddleService: MockPaddleService;
  supportersService: MockSupportersService;
  messageBrokerService: MockMessageBrokerService;
  generateId(): string;
  createUser(overrides?: Partial<IUser>): Promise<IUser>;
  createPricingPreviewResponse(
    overrides?: Partial<PaddlePricingPreviewResponse>,
  ): PaddlePricingPreviewResponse;
  createSubscriptionPreviewResponse(
    overrides?: Partial<PaddleSubscriptionPreviewResponse["data"]>,
  ): PaddleSubscriptionPreviewResponse;
}

export interface SupporterSubscriptionsHarness {
  setup(): Promise<void>;
  teardown(): Promise<void>;
  createContext(
    options?: SupporterSubscriptionsContextOptions,
  ): SupporterSubscriptionsContext;
}

function createMockPaddleService(
  options: SupporterSubscriptionsContextOptions["paddleService"] = {},
): MockPaddleService {
  return {
    getProducts: mock.fn(
      options.getProducts ??
        (async () => ({
          products: [],
        })),
    ),
    executeApiCall: mock.fn(
      options.executeApiCall ?? (async <T>(): Promise<T> => ({}) as T),
    ),
  };
}

function createMockSupportersService(
  options: SupporterSubscriptionsContextOptions["supportersService"] = {},
): MockSupportersService {
  return {
    getSupporterSubscription: mock.fn(
      options.getSupporterSubscription ??
        (async () => ({
          discordUserId: undefined,
          customer: null,
          subscription: null,
        })),
    ),
  };
}

function createMockMessageBrokerService(
  options: SupporterSubscriptionsContextOptions["messageBrokerService"] = {},
): MockMessageBrokerService {
  return {
    publishSyncSupporterDiscordRoles: mock.fn(
      options.publishSyncSupporterDiscordRoles ?? (async () => {}),
    ),
  };
}

export function createSupporterSubscriptionsHarness(): SupporterSubscriptionsHarness {
  let testContext: ServiceTestContext;
  let userRepository: UserMongooseRepository;

  return {
    async setup() {
      testContext = await createServiceTestContext();
      userRepository = new UserMongooseRepository(testContext.connection);
    },

    async teardown() {
      await testContext.teardown();
    },

    createContext(
      options: SupporterSubscriptionsContextOptions = {},
    ): SupporterSubscriptionsContext {
      const config = { ...DEFAULT_CONFIG, ...options.config } as Config;

      const paddleService = createMockPaddleService(options.paddleService);
      const supportersService = createMockSupportersService(
        options.supportersService,
      );
      const messageBrokerService = createMockMessageBrokerService(
        options.messageBrokerService,
      );

      const service = new SupporterSubscriptionsService({
        config,
        paddleService: paddleService as unknown as PaddleService,
        supportersService: supportersService as unknown as SupportersService,
        messageBrokerService:
          messageBrokerService as unknown as MessageBrokerService,
        userRepository,
      });

      return {
        service,
        userRepository,
        paddleService,
        supportersService,
        messageBrokerService,
        generateId: generateTestId,

        async createUser(overrides: Partial<IUser> = {}) {
          const discordUserId = overrides.discordUserId ?? generateTestId();
          const email =
            "email" in overrides
              ? overrides.email
              : `${generateTestId()}@test.com`;
          return userRepository.create({ discordUserId, email });
        },

        createPricingPreviewResponse(
          overrides: Partial<PaddlePricingPreviewResponse> = {},
        ): PaddlePricingPreviewResponse {
          return {
            data: {
              currency_code: "USD",
              details: {
                line_items: [],
              },
              ...overrides.data,
            },
          };
        },

        createSubscriptionPreviewResponse(
          overrides: Partial<PaddleSubscriptionPreviewResponse["data"]> = {},
        ): PaddleSubscriptionPreviewResponse {
          const now = new Date().toISOString();
          return {
            data: {
              immediate_transaction: {
                billing_period: {
                  starts_at: now,
                  ends_at: now,
                },
                details: {
                  line_items: [],
                  totals: {
                    subtotal: "1000",
                    tax: "100",
                    total: "1100",
                    credit: "0",
                    grand_total: "1100",
                    balance: "1100",
                  },
                },
                ...overrides.immediate_transaction,
              },
            },
          };
        },
      };
    },
  };
}
