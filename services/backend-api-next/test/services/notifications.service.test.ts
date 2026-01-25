import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { NotificationsService } from "../../src/services/notifications/notifications.service";
import type { Config } from "../../src/config";
import type { SmtpTransport } from "../../src/infra/smtp";
import type { IUserFeedRepository, UserFeedForNotification } from "../../src/repositories/interfaces/user-feed.types";
import type { INotificationDeliveryAttemptRepository } from "../../src/repositories/interfaces/notification-delivery-attempt.types";
import type { UsersService } from "../../src/services/users/users.service";
import type { IDiscordChannelConnection } from "../../src/repositories/interfaces/feed-connection.types";
import {
  UserFeedDisabledCode,
  FeedConnectionDisabledCode,
  NotificationDeliveryAttemptStatus,
  NotificationDeliveryAttemptType,
  UserFeedManagerStatus,
} from "../../src/repositories/shared/enums";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let smtpTransport: {
    sendMail: ReturnType<typeof mock.fn>;
  };
  let usersService: {
    getEmailsForAlerts: ReturnType<typeof mock.fn>;
  };
  let userFeedRepository: {
    findByIdsForNotification: ReturnType<typeof mock.fn>;
  };
  let notificationDeliveryAttemptRepository: {
    createMany: ReturnType<typeof mock.fn>;
    updateManyByIds: ReturnType<typeof mock.fn>;
  };

  const mockConfig = {
    BACKEND_API_SMTP_FROM: '"Test Alerts" <alerts@test.com>',
    BACKEND_API_LOGIN_REDIRECT_URI: "https://my.test.com",
  } as Config;

  const createMockFeed = (overrides?: Partial<UserFeedForNotification>): UserFeedForNotification => ({
    id: "feed-id",
    title: "Test Feed",
    url: "https://example.com/feed.xml",
    user: { discordUserId: "owner-discord-id" },
    connections: { discordChannels: [] },
    ...overrides,
  });

  const createMockConnection = (overrides?: Partial<IDiscordChannelConnection>): IDiscordChannelConnection => ({
    id: "connection-id",
    name: "Test Connection",
    details: {
      channel: { id: "channel-id", guildId: "guild-id" },
      embeds: [],
      componentRows: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    smtpTransport = {
      sendMail: mock.fn(() => Promise.resolve({ messageId: "msg-id" })),
    };
    usersService = {
      getEmailsForAlerts: mock.fn(() => Promise.resolve(["user@test.com"])),
    };
    userFeedRepository = {
      findByIdsForNotification: mock.fn(() => Promise.resolve([createMockFeed()])),
    };
    notificationDeliveryAttemptRepository = {
      createMany: mock.fn(() =>
        Promise.resolve([
          {
            id: "attempt-id",
            email: "user@test.com",
            status: NotificationDeliveryAttemptStatus.Pending,
            type: NotificationDeliveryAttemptType.DisabledFeed,
            feedId: "feed-id",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
      ),
      updateManyByIds: mock.fn(() => Promise.resolve()),
    };

    service = new NotificationsService({
      config: mockConfig,
      smtpTransport: smtpTransport as unknown as SmtpTransport,
      usersService: usersService as unknown as UsersService,
      userFeedRepository: userFeedRepository as unknown as IUserFeedRepository,
      notificationDeliveryAttemptRepository:
        notificationDeliveryAttemptRepository as unknown as INotificationDeliveryAttemptRepository,
    });
  });

  describe("sendDisabledFeedsAlert", () => {
    it("sends email alert for disabled feed", async () => {
      await service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      assert.strictEqual(userFeedRepository.findByIdsForNotification.mock.calls.length, 1);
      assert.deepStrictEqual(
        userFeedRepository.findByIdsForNotification.mock.calls[0]?.arguments[0],
        ["feed-id"]
      );
      assert.strictEqual(smtpTransport.sendMail.mock.calls.length, 1);
      assert.strictEqual(
        notificationDeliveryAttemptRepository.updateManyByIds.mock.calls.length,
        1
      );
      assert.deepStrictEqual(
        notificationDeliveryAttemptRepository.updateManyByIds.mock.calls[0]?.arguments,
        [["attempt-id"], { status: NotificationDeliveryAttemptStatus.Success, failReasonInternal: undefined }]
      );
    });

    it("does not send email when no emails to alert", async () => {
      usersService.getEmailsForAlerts.mock.mockImplementation(() => Promise.resolve([]));

      await service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      assert.strictEqual(smtpTransport.sendMail.mock.calls.length, 0);
      assert.strictEqual(notificationDeliveryAttemptRepository.createMany.mock.calls.length, 0);
    });

    it("handles null SMTP transport gracefully", async () => {
      const serviceWithNullSmtp = new NotificationsService({
        config: mockConfig,
        smtpTransport: null,
        usersService: usersService as unknown as UsersService,
        userFeedRepository: userFeedRepository as unknown as IUserFeedRepository,
        notificationDeliveryAttemptRepository:
          notificationDeliveryAttemptRepository as unknown as INotificationDeliveryAttemptRepository,
      });

      await serviceWithNullSmtp.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      assert.strictEqual(
        notificationDeliveryAttemptRepository.updateManyByIds.mock.calls.length,
        1
      );
      assert.deepStrictEqual(
        notificationDeliveryAttemptRepository.updateManyByIds.mock.calls[0]?.arguments[1],
        { status: NotificationDeliveryAttemptStatus.Success, failReasonInternal: undefined }
      );
    });

    it("updates delivery attempt to failure when SMTP send fails", async () => {
      smtpTransport.sendMail.mock.mockImplementation(() =>
        Promise.reject(new Error("SMTP connection failed"))
      );

      await service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      assert.strictEqual(
        notificationDeliveryAttemptRepository.updateManyByIds.mock.calls.length,
        1
      );
      assert.deepStrictEqual(
        notificationDeliveryAttemptRepository.updateManyByIds.mock.calls[0]?.arguments,
        [
          ["attempt-id"],
          {
            status: NotificationDeliveryAttemptStatus.Failure,
            failReasonInternal: "SMTP connection failed",
          },
        ]
      );
    });

    it("logs error but does not throw when SMTP send fails", async () => {
      smtpTransport.sendMail.mock.mockImplementation(() =>
        Promise.reject(new Error("SMTP connection failed"))
      );

      await assert.doesNotReject(async () => {
        await service.sendDisabledFeedsAlert(["feed-id"], {
          disabledCode: UserFeedDisabledCode.FailedRequests,
        });
      });
    });

    it("processes multiple feeds in parallel", async () => {
      const feeds = [
        createMockFeed({ id: "feed-1", title: "Feed 1" }),
        createMockFeed({ id: "feed-2", title: "Feed 2" }),
      ];
      userFeedRepository.findByIdsForNotification.mock.mockImplementation(() =>
        Promise.resolve(feeds)
      );
      notificationDeliveryAttemptRepository.createMany.mock.mockImplementation(
        (inputs: Array<{ feedId: string }>) =>
          Promise.resolve(
            inputs.map((input, i) => ({
              id: `attempt-${i}`,
              email: "user@test.com",
              status: NotificationDeliveryAttemptStatus.Pending,
              type: NotificationDeliveryAttemptType.DisabledFeed,
              feedId: input.feedId,
              createdAt: new Date(),
              updatedAt: new Date(),
            }))
          )
      );

      await service.sendDisabledFeedsAlert(["feed-1", "feed-2"], {
        disabledCode: UserFeedDisabledCode.InvalidFeed,
      });

      assert.strictEqual(smtpTransport.sendMail.mock.calls.length, 2);
    });

    it("includes accepted invite user IDs when gathering emails", async () => {
      const feedWithInvites = createMockFeed({
        shareManageOptions: {
          invites: [
            {
              id: "invite-1",
              type: 0 as never,
              discordUserId: "invited-user-1",
              status: UserFeedManagerStatus.Accepted,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: "invite-2",
              type: 0 as never,
              discordUserId: "invited-user-2",
              status: UserFeedManagerStatus.Pending,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      });
      userFeedRepository.findByIdsForNotification.mock.mockImplementation(() =>
        Promise.resolve([feedWithInvites])
      );

      await service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      assert.strictEqual(usersService.getEmailsForAlerts.mock.calls.length, 1);
      const calledWithUserIds = usersService.getEmailsForAlerts.mock.calls[0]?.arguments[0] as string[];
      assert.ok(calledWithUserIds.includes("invited-user-1"));
      assert.ok(calledWithUserIds.includes("owner-discord-id"));
      assert.ok(!calledWithUserIds.includes("invited-user-2"));
    });

    it("uses correct email template data for each disabled code", async () => {
      await service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
      });

      const sendMailCall = smtpTransport.sendMail.mock.calls[0]?.arguments[0] as {
        subject: string;
        html: string;
      };
      assert.ok(sendMailCall.subject.includes("Test Feed"));
      assert.ok(sendMailCall.html.includes("Exceeded feed limit"));
    });

    it("uses default from address when not configured", async () => {
      const serviceWithDefaultFrom = new NotificationsService({
        config: { ...mockConfig, BACKEND_API_SMTP_FROM: undefined } as Config,
        smtpTransport: smtpTransport as unknown as SmtpTransport,
        usersService: usersService as unknown as UsersService,
        userFeedRepository: userFeedRepository as unknown as IUserFeedRepository,
        notificationDeliveryAttemptRepository:
          notificationDeliveryAttemptRepository as unknown as INotificationDeliveryAttemptRepository,
      });

      await serviceWithDefaultFrom.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      const sendMailCall = smtpTransport.sendMail.mock.calls[0]?.arguments[0] as { from: string };
      assert.strictEqual(sendMailCall.from, '"MonitoRSS Alerts" <alerts@monitorss.xyz>');
    });

    it("handles delivery attempt creation failure gracefully", async () => {
      notificationDeliveryAttemptRepository.createMany.mock.mockImplementation(() =>
        Promise.reject(new Error("DB connection failed"))
      );

      await assert.doesNotReject(async () => {
        await service.sendDisabledFeedsAlert(["feed-id"], {
          disabledCode: UserFeedDisabledCode.FailedRequests,
        });
      });

      assert.strictEqual(smtpTransport.sendMail.mock.calls.length, 1);
      assert.strictEqual(
        notificationDeliveryAttemptRepository.updateManyByIds.mock.calls.length,
        0
      );
    });

    it("handles delivery attempt update failure gracefully", async () => {
      notificationDeliveryAttemptRepository.updateManyByIds.mock.mockImplementation(() =>
        Promise.reject(new Error("DB connection failed"))
      );

      await assert.doesNotReject(async () => {
        await service.sendDisabledFeedsAlert(["feed-id"], {
          disabledCode: UserFeedDisabledCode.FailedRequests,
        });
      });
    });

    it("truncates long feed titles in email subject", async () => {
      const longTitleFeed = createMockFeed({
        title: "A".repeat(100),
      });
      userFeedRepository.findByIdsForNotification.mock.mockImplementation(() =>
        Promise.resolve([longTitleFeed])
      );

      await service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      const sendMailCall = smtpTransport.sendMail.mock.calls[0]?.arguments[0] as {
        html: string;
      };
      assert.ok(sendMailCall.html.includes("A".repeat(50) + "..."));
    });
  });

  describe("sendDisabledFeedConnectionAlert", () => {
    it("sends email alert for disabled connection", async () => {
      const feed = createMockFeed({
        connections: {
          discordChannels: [createMockConnection()],
        },
      });
      const connection = createMockConnection();

      await service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.MissingPermissions,
      });

      assert.strictEqual(smtpTransport.sendMail.mock.calls.length, 1);
      const sendMailCall = smtpTransport.sendMail.mock.calls[0]?.arguments[0] as {
        subject: string;
        html: string;
      };
      assert.ok(sendMailCall.subject.includes("Test Connection"));
      assert.ok(sendMailCall.subject.includes("Test Feed"));
    });

    it("does not send email when no emails to alert", async () => {
      usersService.getEmailsForAlerts.mock.mockImplementation(() => Promise.resolve([]));
      const feed = createMockFeed();
      const connection = createMockConnection();

      await service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.BadFormat,
      });

      assert.strictEqual(smtpTransport.sendMail.mock.calls.length, 0);
    });

    it("throws error when SMTP send fails", async () => {
      smtpTransport.sendMail.mock.mockImplementation(() =>
        Promise.reject(new Error("SMTP failed"))
      );
      const feed = createMockFeed();
      const connection = createMockConnection();

      await assert.rejects(
        () =>
          service.sendDisabledFeedConnectionAlert(feed, connection, {
            disabledCode: FeedConnectionDisabledCode.Unknown,
          }),
        { message: "SMTP failed" }
      );

      assert.deepStrictEqual(
        notificationDeliveryAttemptRepository.updateManyByIds.mock.calls[0]?.arguments[1],
        {
          status: NotificationDeliveryAttemptStatus.Failure,
          failReasonInternal: "SMTP failed",
        }
      );
    });

    it("includes discord-channel-connections prefix in control panel URL for discord channels", async () => {
      const connection = createMockConnection({ id: "conn-123" });
      const feed = createMockFeed({
        id: "feed-456",
        connections: { discordChannels: [connection] },
      });

      await service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.MissingMedium,
      });

      const sendMailCall = smtpTransport.sendMail.mock.calls[0]?.arguments[0] as { html: string };
      assert.ok(
        sendMailCall.html.includes(
          "https://my.test.com/feeds/feed-456/discord-channel-connections/conn-123"
        )
      );
    });

    it("does not include connection prefix when connection is not in feed connections", async () => {
      const connection = createMockConnection({ id: "orphan-conn" });
      const feed = createMockFeed({
        id: "feed-789",
        connections: { discordChannels: [] },
      });

      await service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.BadFormat,
      });

      const sendMailCall = smtpTransport.sendMail.mock.calls[0]?.arguments[0] as { html: string };
      assert.ok(sendMailCall.html.includes("https://my.test.com/feeds/feed-789"));
      assert.ok(!sendMailCall.html.includes("discord-channel-connections"));
    });

    it("includes article ID and rejected message in template when provided", async () => {
      const feed = createMockFeed();
      const connection = createMockConnection();

      await service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.BadFormat,
        articleId: "article-123",
        rejectedMessage: "Invalid embed structure",
      });

      const sendMailCall = smtpTransport.sendMail.mock.calls[0]?.arguments[0] as { html: string };
      assert.ok(sendMailCall.html.includes("article-123") || sendMailCall.html.includes("Invalid embed structure"));
    });

    it("creates delivery attempt with DisabledConnection type", async () => {
      const feed = createMockFeed();
      const connection = createMockConnection();

      await service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.Unknown,
      });

      assert.strictEqual(notificationDeliveryAttemptRepository.createMany.mock.calls.length, 1);
      const createCall = notificationDeliveryAttemptRepository.createMany.mock.calls[0]
        ?.arguments[0] as Array<{ type: NotificationDeliveryAttemptType }>;
      assert.strictEqual(createCall[0]?.type, NotificationDeliveryAttemptType.DisabledConnection);
    });

    it("sends to multiple emails when multiple users have alert preferences", async () => {
      usersService.getEmailsForAlerts.mock.mockImplementation(() =>
        Promise.resolve(["user1@test.com", "user2@test.com"])
      );
      notificationDeliveryAttemptRepository.createMany.mock.mockImplementation(
        (inputs: Array<{ email: string }>) =>
          Promise.resolve(
            inputs.map((input, i) => ({
              id: `attempt-${i}`,
              email: input.email,
              status: NotificationDeliveryAttemptStatus.Pending,
              type: NotificationDeliveryAttemptType.DisabledConnection,
              feedId: "feed-id",
              createdAt: new Date(),
              updatedAt: new Date(),
            }))
          )
      );

      const feed = createMockFeed();
      const connection = createMockConnection();

      await service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.MissingPermissions,
      });

      const sendMailCall = smtpTransport.sendMail.mock.calls[0]?.arguments[0] as { to: string[] };
      assert.deepStrictEqual(sendMailCall.to, ["user1@test.com", "user2@test.com"]);
    });

    it("uses correct reason from constants for each disabled code", async () => {
      const feed = createMockFeed();
      const connection = createMockConnection();

      await service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.MissingMedium,
      });

      const sendMailCall = smtpTransport.sendMail.mock.calls[0]?.arguments[0] as { html: string };
      assert.ok(sendMailCall.html.includes("channel with the service provider is missing"));
    });

    it("falls back to disabled code when reason not in constants", async () => {
      const feed = createMockFeed();
      const connection = createMockConnection();

      await service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.Manual,
      });

      const sendMailCall = smtpTransport.sendMail.mock.calls[0]?.arguments[0] as { html: string };
      assert.ok(sendMailCall.html.includes("MANUAL"));
    });
  });
});
