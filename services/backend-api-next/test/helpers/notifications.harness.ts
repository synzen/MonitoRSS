import { mock } from "node:test";
import { NotificationsService } from "../../src/services/notifications/notifications.service";
import type { Config } from "../../src/config";
import type { SmtpTransport } from "../../src/infra/smtp";
import type {
  IUserFeedRepository,
  UserFeedForNotification,
} from "../../src/repositories/interfaces/user-feed.types";
import type { INotificationDeliveryAttemptRepository } from "../../src/repositories/interfaces/notification-delivery-attempt.types";
import type { UsersService } from "../../src/services/users/users.service";
import type { IDiscordChannelConnection } from "../../src/repositories/interfaces/feed-connection.types";
import {
  NotificationDeliveryAttemptStatus,
  NotificationDeliveryAttemptType,
  UserFeedManagerStatus,
} from "../../src/repositories/shared/enums";
import { generateTestId } from "./test-id";

const DEFAULT_CONFIG = {
  BACKEND_API_SMTP_FROM: '"Test Alerts" <alerts@test.com>',
  BACKEND_API_LOGIN_REDIRECT_URI: "https://my.test.com",
} as Config;

export interface SmtpTransportMockOptions {
  sendMail?: () => Promise<{ messageId: string }> | Promise<never>;
}

export interface UsersServiceMockOptions {
  emails?: string[];
}

export interface UserFeedRepositoryMockOptions {
  feeds?: UserFeedForNotification[];
}

export interface NotificationDeliveryAttemptRepositoryMockOptions {
  createMany?: (inputs: Array<{ feedId: string; email: string }>) => Promise<
    Array<{
      id: string;
      email: string;
      status: NotificationDeliveryAttemptStatus;
      type: NotificationDeliveryAttemptType;
      feedId: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  >;
  updateManyByIds?: () => Promise<void>;
}

export interface NotificationsContextOptions {
  config?: Partial<Config>;
  smtpTransport?: SmtpTransportMockOptions | null;
  usersService?: UsersServiceMockOptions;
  userFeedRepository?: UserFeedRepositoryMockOptions;
  notificationDeliveryAttemptRepository?: NotificationDeliveryAttemptRepositoryMockOptions;
}

export interface MockSmtpTransport {
  sendMail: ReturnType<typeof mock.fn>;
}

export interface MockUsersService {
  getEmailsForAlerts: ReturnType<typeof mock.fn>;
}

export interface MockUserFeedRepository {
  findByIdsForNotification: ReturnType<typeof mock.fn>;
}

export interface MockNotificationDeliveryAttemptRepository {
  createMany: ReturnType<typeof mock.fn>;
  updateManyByIds: ReturnType<typeof mock.fn>;
}

export interface NotificationsContext {
  service: NotificationsService;
  smtpTransport: MockSmtpTransport | null;
  usersService: MockUsersService;
  userFeedRepository: MockUserFeedRepository;
  notificationDeliveryAttemptRepository: MockNotificationDeliveryAttemptRepository;
  generateId(): string;
  createMockFeed(
    overrides?: Partial<UserFeedForNotification>,
  ): UserFeedForNotification;
  createMockConnection(
    overrides?: Partial<IDiscordChannelConnection>,
  ): IDiscordChannelConnection;
}

export interface NotificationsHarness {
  createContext(options?: NotificationsContextOptions): NotificationsContext;
}

function createDefaultDeliveryAttempt(feedId: string, email: string) {
  return {
    id: generateTestId(),
    email,
    status: NotificationDeliveryAttemptStatus.Pending,
    type: NotificationDeliveryAttemptType.DisabledFeed,
    feedId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createNotificationsHarness(): NotificationsHarness {
  return {
    createContext(
      options: NotificationsContextOptions = {},
    ): NotificationsContext {
      const config = { ...DEFAULT_CONFIG, ...options.config } as Config;

      const smtpTransport: MockSmtpTransport | null =
        options.smtpTransport === null
          ? null
          : {
              sendMail: mock.fn(
                options.smtpTransport?.sendMail ??
                  (() => Promise.resolve({ messageId: generateTestId() })),
              ),
            };

      const usersService: MockUsersService = {
        getEmailsForAlerts: mock.fn(() =>
          Promise.resolve(options.usersService?.emails ?? ["user@test.com"]),
        ),
      };

      const defaultFeed = createMockFeed();
      const userFeedRepository: MockUserFeedRepository = {
        findByIdsForNotification: mock.fn(() =>
          Promise.resolve(options.userFeedRepository?.feeds ?? [defaultFeed]),
        ),
      };

      const notificationDeliveryAttemptRepository: MockNotificationDeliveryAttemptRepository =
        {
          createMany: mock.fn(
            options.notificationDeliveryAttemptRepository?.createMany ??
              ((inputs: Array<{ feedId: string; email: string }>) =>
                Promise.resolve(
                  inputs.map((input) =>
                    createDefaultDeliveryAttempt(input.feedId, input.email),
                  ),
                )),
          ),
          updateManyByIds: mock.fn(
            options.notificationDeliveryAttemptRepository?.updateManyByIds ??
              (() => Promise.resolve()),
          ),
        };

      const service = new NotificationsService({
        config,
        smtpTransport: smtpTransport as unknown as SmtpTransport,
        usersService: usersService as unknown as UsersService,
        userFeedRepository:
          userFeedRepository as unknown as IUserFeedRepository,
        notificationDeliveryAttemptRepository:
          notificationDeliveryAttemptRepository as unknown as INotificationDeliveryAttemptRepository,
      });

      return {
        service,
        smtpTransport,
        usersService,
        userFeedRepository,
        notificationDeliveryAttemptRepository,
        generateId: generateTestId,
        createMockFeed,
        createMockConnection,
      };
    },
  };
}

export function createMockFeed(
  overrides?: Partial<UserFeedForNotification>,
): UserFeedForNotification {
  return {
    id: overrides?.id ?? generateTestId(),
    title: overrides?.title ?? "Test Feed",
    url: overrides?.url ?? "https://example.com/feed.xml",
    user: overrides?.user ?? { discordUserId: generateTestId() },
    connections: overrides?.connections ?? { discordChannels: [] },
    ...overrides,
  };
}

export function createMockConnection(
  overrides?: Partial<IDiscordChannelConnection>,
): IDiscordChannelConnection {
  return {
    id: overrides?.id ?? generateTestId(),
    name: overrides?.name ?? "Test Connection",
    details: overrides?.details ?? {
      channel: { id: generateTestId(), guildId: generateTestId() },
      embeds: [],
      componentRows: [],
      formatter: {},
    },
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
    ...overrides,
  };
}

export { UserFeedManagerStatus };
