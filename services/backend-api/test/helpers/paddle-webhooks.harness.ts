import { mock, type Mock } from "node:test";
import { createHmac } from "crypto";
import type { Config } from "../../src/config";
import { SupporterMongooseRepository } from "../../src/repositories/mongoose/supporter.mongoose.repository";
import { UserMongooseRepository } from "../../src/repositories/mongoose/user.mongoose.repository";
import { PaddleWebhooksService } from "../../src/services/paddle-webhooks/paddle-webhooks.service";
import type { PaddleService } from "../../src/services/paddle/paddle.service";
import type { SupportersService } from "../../src/services/supporters/supporters.service";
import type { UserFeedsService } from "../../src/services/user-feeds/user-feeds.service";
import type {
  PaddleEventSubscriptionUpdated,
  PaddleEventSubscriptionActivated,
  PaddleEventSubscriptionCanceled,
  PaddleSubscriptionStatus,
} from "../../src/services/paddle-webhooks/types";
import {
  SubscriptionProductKey,
  LegacySubscriptionProductKey,
} from "../../src/repositories/shared/enums";
import type { IUser } from "../../src/repositories/interfaces/user.types";
import type { ISupporter } from "../../src/repositories/interfaces/supporter.types";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "./test-context";
import { generateTestId } from "./test-id";

const WEBHOOK_SECRET = "test-webhook-secret-key";

const DEFAULT_CONFIG = {
  BACKEND_API_PADDLE_WEBHOOK_SECRET: WEBHOOK_SECRET,
} as Config;

export interface MockPaddleService {
  getProduct: Mock<
    (productId: string) => Promise<{
      paddleProductId: string;
      id: SubscriptionProductKey | LegacySubscriptionProductKey | undefined;
    }>
  >;
  getCustomer: Mock<(id: string) => Promise<{ email: string }>>;
}

export interface MockSupportersService {
  syncDiscordSupporterRoles: Mock<(discordUserId: string) => Promise<void>>;
}

export interface MockUserFeedsService {
  enforceUserFeedLimit: Mock<(discordUserId: string) => Promise<void>>;
}

export interface PaddleWebhooksContextOptions {
  config?: Partial<Config>;
  paddleService?: {
    getProduct?: (productId: string) => Promise<{
      paddleProductId: string;
      id: SubscriptionProductKey | LegacySubscriptionProductKey | undefined;
    }>;
    getCustomer?: (id: string) => Promise<{ email: string }>;
  };
  supportersService?: {
    syncDiscordSupporterRoles?: (discordUserId: string) => Promise<void>;
  };
  userFeedsService?: {
    enforceUserFeedLimit?: (discordUserId: string) => Promise<void>;
  };
}

export interface PaddleWebhooksContext {
  service: PaddleWebhooksService;
  supporterRepository: SupporterMongooseRepository;
  userRepository: UserMongooseRepository;
  paddleService: MockPaddleService;
  supportersService: MockSupportersService;
  userFeedsService: MockUserFeedsService;
  generateId(): string;
  createUser(overrides?: Partial<IUser>): Promise<IUser>;
  createSupporter(overrides?: Partial<ISupporter>): Promise<ISupporter>;
  createWebhookSignature(requestBody: string, timestamp?: string): string;
  createSubscriptionUpdatedEvent(
    overrides?: Partial<PaddleEventSubscriptionUpdated["data"]>,
  ): PaddleEventSubscriptionUpdated;
  createSubscriptionActivatedEvent(
    overrides?: Partial<PaddleEventSubscriptionActivated["data"]>,
  ): PaddleEventSubscriptionActivated;
  createSubscriptionCanceledEvent(
    overrides?: Partial<PaddleEventSubscriptionCanceled["data"]>,
  ): PaddleEventSubscriptionCanceled;
}

export interface PaddleWebhooksHarness {
  setup(): Promise<void>;
  teardown(): Promise<void>;
  createContext(options?: PaddleWebhooksContextOptions): PaddleWebhooksContext;
}

function createMockPaddleService(
  options: PaddleWebhooksContextOptions["paddleService"] = {},
): MockPaddleService {
  return {
    getProduct: mock.fn(
      options.getProduct ??
        (async (productId: string) => ({
          paddleProductId: productId,
          id: SubscriptionProductKey.Tier1,
        })),
    ),
    getCustomer: mock.fn(
      options.getCustomer ??
        (async () => ({
          email: "test@example.com",
        })),
    ),
  };
}

function createMockSupportersService(
  options: PaddleWebhooksContextOptions["supportersService"] = {},
): MockSupportersService {
  return {
    syncDiscordSupporterRoles: mock.fn(
      options.syncDiscordSupporterRoles ?? (async () => {}),
    ),
  };
}

function createMockUserFeedsService(
  options: PaddleWebhooksContextOptions["userFeedsService"] = {},
): MockUserFeedsService {
  return {
    enforceUserFeedLimit: mock.fn(
      options.enforceUserFeedLimit ?? (async () => {}),
    ),
  };
}

export function createPaddleWebhooksHarness(): PaddleWebhooksHarness {
  let testContext: ServiceTestContext;
  let supporterRepository: SupporterMongooseRepository;
  let userRepository: UserMongooseRepository;

  return {
    async setup() {
      testContext = await createServiceTestContext();
      supporterRepository = new SupporterMongooseRepository(
        testContext.connection,
      );
      userRepository = new UserMongooseRepository(testContext.connection);
    },

    async teardown() {
      await testContext.teardown();
    },

    createContext(
      options: PaddleWebhooksContextOptions = {},
    ): PaddleWebhooksContext {
      const config = { ...DEFAULT_CONFIG, ...options.config } as Config;

      const paddleService = createMockPaddleService(options.paddleService);
      const supportersService = createMockSupportersService(
        options.supportersService,
      );
      const userFeedsService = createMockUserFeedsService(
        options.userFeedsService,
      );

      const service = new PaddleWebhooksService({
        config,
        paddleService: paddleService as unknown as PaddleService,
        supportersService: supportersService as unknown as SupportersService,
        userFeedsService: userFeedsService as unknown as UserFeedsService,
        supporterRepository,
        userRepository,
      });

      return {
        service,
        supporterRepository,
        userRepository,
        paddleService,
        supportersService,
        userFeedsService,
        generateId: generateTestId,

        async createUser(overrides: Partial<IUser> = {}) {
          const discordUserId = overrides.discordUserId ?? generateTestId();
          const email = overrides.email ?? `${generateTestId()}@test.com`;
          return userRepository.create({ discordUserId, email });
        },

        async createSupporter(overrides = {}) {
          const supporter: ISupporter = {
            id: overrides.id ?? generateTestId(),
            guilds: overrides.guilds ?? [],
            patron: overrides.patron ?? false,
            ...overrides,
          };
          return supporterRepository.create(supporter);
        },

        createWebhookSignature(requestBody: string, timestamp?: string) {
          const ts = timestamp ?? String(Math.floor(Date.now() / 1000));
          const signedPayload = `${ts}:${requestBody}`;
          const hmac = createHmac("sha256", WEBHOOK_SECRET)
            .update(signedPayload)
            .digest("hex");
          return `ts=${ts};h1=${hmac}`;
        },

        createSubscriptionUpdatedEvent(overrides = {}) {
          const now = new Date().toISOString();
          return {
            event_type: "subscription.updated" as const,
            data: {
              id: generateTestId(),
              status: "active" as PaddleSubscriptionStatus,
              customer_id: generateTestId(),
              created_at: now,
              custom_data: {
                userId: generateTestId(),
              },
              updated_at: now,
              items: [
                {
                  quantity: 1,
                  price: {
                    id: generateTestId(),
                    product_id: generateTestId(),
                  },
                },
              ],
              billing_cycle: {
                interval: "month" as const,
                frequency: 1,
              },
              currency_code: "USD",
              next_billed_at: now,
              scheduled_change: null,
              current_billing_period: {
                ends_at: now,
                starts_at: now,
              },
              ...overrides,
            },
          };
        },

        createSubscriptionActivatedEvent(overrides = {}) {
          const now = new Date().toISOString();
          return {
            event_type: "subscription.activated" as const,
            data: {
              id: generateTestId(),
              status: "active" as PaddleSubscriptionStatus,
              customer_id: generateTestId(),
              created_at: now,
              custom_data: {
                userId: generateTestId(),
              },
              updated_at: now,
              items: [
                {
                  quantity: 1,
                  price: {
                    id: generateTestId(),
                    product_id: generateTestId(),
                  },
                },
              ],
              billing_cycle: {
                interval: "month" as const,
                frequency: 1,
              },
              currency_code: "USD",
              next_billed_at: now,
              scheduled_change: null,
              current_billing_period: {
                ends_at: now,
                starts_at: now,
              },
              ...overrides,
            },
          };
        },

        createSubscriptionCanceledEvent(overrides = {}) {
          return {
            event_type: "subscription.canceled" as const,
            data: {
              id: overrides.id ?? generateTestId(),
              status: "canceled" as PaddleSubscriptionStatus.Cancelled,
              customer_id: overrides.customer_id ?? generateTestId(),
            },
          };
        },
      };
    },
  };
}
