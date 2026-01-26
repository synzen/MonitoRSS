import { describe, it } from "node:test";
import assert from "node:assert";
import {
  createNotificationsHarness,
  createMockFeed,
  createMockConnection,
  UserFeedManagerStatus,
} from "../helpers/notifications.harness";
import {
  UserFeedDisabledCode,
  FeedConnectionDisabledCode,
  NotificationDeliveryAttemptStatus,
  NotificationDeliveryAttemptType,
} from "../../src/repositories/shared/enums";

describe("NotificationsService", { concurrency: true }, () => {
  const harness = createNotificationsHarness();

  describe("sendDisabledFeedsAlert", () => {
    it("sends email alert for disabled feed", async () => {
      const feed = createMockFeed({ id: "feed-id" });
      const ctx = harness.createContext({
        userFeedRepository: { feeds: [feed] },
      });

      await ctx.service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      assert.strictEqual(ctx.userFeedRepository.findByIdsForNotification.mock.calls.length, 1);
      assert.deepStrictEqual(
        ctx.userFeedRepository.findByIdsForNotification.mock.calls[0]?.arguments[0],
        ["feed-id"]
      );
      assert.strictEqual(ctx.smtpTransport!.sendMail.mock.calls.length, 1);
      assert.strictEqual(
        ctx.notificationDeliveryAttemptRepository.updateManyByIds.mock.calls.length,
        1
      );
    });

    it("does not send email when no emails to alert", async () => {
      const ctx = harness.createContext({
        usersService: { emails: [] },
      });

      await ctx.service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      assert.strictEqual(ctx.smtpTransport!.sendMail.mock.calls.length, 0);
      assert.strictEqual(ctx.notificationDeliveryAttemptRepository.createMany.mock.calls.length, 0);
    });

    it("handles null SMTP transport gracefully", async () => {
      const ctx = harness.createContext({
        smtpTransport: null,
      });

      await ctx.service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      assert.strictEqual(
        ctx.notificationDeliveryAttemptRepository.updateManyByIds.mock.calls.length,
        1
      );
      assert.deepStrictEqual(
        ctx.notificationDeliveryAttemptRepository.updateManyByIds.mock.calls[0]?.arguments[1],
        { status: NotificationDeliveryAttemptStatus.Success, failReasonInternal: undefined }
      );
    });

    it("updates delivery attempt to failure when SMTP send fails", async () => {
      const ctx = harness.createContext({
        smtpTransport: {
          sendMail: () => Promise.reject(new Error("SMTP connection failed")),
        },
      });

      await ctx.service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      assert.strictEqual(
        ctx.notificationDeliveryAttemptRepository.updateManyByIds.mock.calls.length,
        1
      );
      const updateArgs = ctx.notificationDeliveryAttemptRepository.updateManyByIds.mock.calls[0]?.arguments;
      assert.ok(Array.isArray(updateArgs?.[0]));
      assert.strictEqual(updateArgs?.[0]?.length, 1);
      assert.deepStrictEqual(updateArgs?.[1], {
        status: NotificationDeliveryAttemptStatus.Failure,
        failReasonInternal: "SMTP connection failed",
      });
    });

    it("logs error but does not throw when SMTP send fails", async () => {
      const ctx = harness.createContext({
        smtpTransport: {
          sendMail: () => Promise.reject(new Error("SMTP connection failed")),
        },
      });

      await assert.doesNotReject(async () => {
        await ctx.service.sendDisabledFeedsAlert(["feed-id"], {
          disabledCode: UserFeedDisabledCode.FailedRequests,
        });
      });
    });

    it("processes multiple feeds in parallel", async () => {
      const feeds = [
        createMockFeed({ id: "feed-1", title: "Feed 1" }),
        createMockFeed({ id: "feed-2", title: "Feed 2" }),
      ];
      const ctx = harness.createContext({
        userFeedRepository: { feeds },
      });

      await ctx.service.sendDisabledFeedsAlert(["feed-1", "feed-2"], {
        disabledCode: UserFeedDisabledCode.InvalidFeed,
      });

      assert.strictEqual(ctx.smtpTransport!.sendMail.mock.calls.length, 2);
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
        user: { discordUserId: "owner-discord-id" },
      });
      const ctx = harness.createContext({
        userFeedRepository: { feeds: [feedWithInvites] },
      });

      await ctx.service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      assert.strictEqual(ctx.usersService.getEmailsForAlerts.mock.calls.length, 1);
      const calledWithUserIds = ctx.usersService.getEmailsForAlerts.mock.calls[0]?.arguments[0] as string[];
      assert.ok(calledWithUserIds.includes("invited-user-1"));
      assert.ok(calledWithUserIds.includes("owner-discord-id"));
      assert.ok(!calledWithUserIds.includes("invited-user-2"));
    });

    it("uses correct email template data for each disabled code", async () => {
      const feed = createMockFeed({ title: "Test Feed" });
      const ctx = harness.createContext({
        userFeedRepository: { feeds: [feed] },
      });

      await ctx.service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
      });

      const sendMailCall = ctx.smtpTransport!.sendMail.mock.calls[0]?.arguments[0] as {
        subject: string;
        html: string;
      };
      assert.ok(sendMailCall.subject.includes("Test Feed"));
      assert.ok(sendMailCall.html.includes("Exceeded feed limit"));
    });

    it("uses default from address when not configured", async () => {
      const ctx = harness.createContext({
        config: { BACKEND_API_SMTP_FROM: undefined },
      });

      await ctx.service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      const sendMailCall = ctx.smtpTransport!.sendMail.mock.calls[0]?.arguments[0] as { from: string };
      assert.strictEqual(sendMailCall.from, '"MonitoRSS Alerts" <alerts@monitorss.xyz>');
    });

    it("handles delivery attempt creation failure gracefully", async () => {
      const ctx = harness.createContext({
        notificationDeliveryAttemptRepository: {
          createMany: () => Promise.reject(new Error("DB connection failed")),
        },
      });

      await assert.doesNotReject(async () => {
        await ctx.service.sendDisabledFeedsAlert(["feed-id"], {
          disabledCode: UserFeedDisabledCode.FailedRequests,
        });
      });

      assert.strictEqual(ctx.smtpTransport!.sendMail.mock.calls.length, 1);
      assert.strictEqual(
        ctx.notificationDeliveryAttemptRepository.updateManyByIds.mock.calls.length,
        0
      );
    });

    it("handles delivery attempt update failure gracefully", async () => {
      const ctx = harness.createContext({
        notificationDeliveryAttemptRepository: {
          updateManyByIds: () => Promise.reject(new Error("DB connection failed")),
        },
      });

      await assert.doesNotReject(async () => {
        await ctx.service.sendDisabledFeedsAlert(["feed-id"], {
          disabledCode: UserFeedDisabledCode.FailedRequests,
        });
      });
    });

    it("truncates long feed titles in email subject", async () => {
      const longTitleFeed = createMockFeed({
        title: "A".repeat(100),
      });
      const ctx = harness.createContext({
        userFeedRepository: { feeds: [longTitleFeed] },
      });

      await ctx.service.sendDisabledFeedsAlert(["feed-id"], {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      const sendMailCall = ctx.smtpTransport!.sendMail.mock.calls[0]?.arguments[0] as {
        html: string;
      };
      assert.ok(sendMailCall.html.includes("A".repeat(50) + "..."));
    });
  });

  describe("sendDisabledFeedConnectionAlert", () => {
    it("sends email alert for disabled connection", async () => {
      const connection = createMockConnection({ name: "Test Connection" });
      const feed = createMockFeed({
        title: "Test Feed",
        connections: { discordChannels: [connection] },
      });
      const ctx = harness.createContext();

      await ctx.service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.MissingPermissions,
      });

      assert.strictEqual(ctx.smtpTransport!.sendMail.mock.calls.length, 1);
      const sendMailCall = ctx.smtpTransport!.sendMail.mock.calls[0]?.arguments[0] as {
        subject: string;
        html: string;
      };
      assert.ok(sendMailCall.subject.includes("Test Connection"));
      assert.ok(sendMailCall.subject.includes("Test Feed"));
    });

    it("does not send email when no emails to alert", async () => {
      const ctx = harness.createContext({
        usersService: { emails: [] },
      });
      const feed = createMockFeed();
      const connection = createMockConnection();

      await ctx.service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.BadFormat,
      });

      assert.strictEqual(ctx.smtpTransport!.sendMail.mock.calls.length, 0);
    });

    it("throws error when SMTP send fails", async () => {
      const ctx = harness.createContext({
        smtpTransport: {
          sendMail: () => Promise.reject(new Error("SMTP failed")),
        },
      });
      const feed = createMockFeed();
      const connection = createMockConnection();

      await assert.rejects(
        () =>
          ctx.service.sendDisabledFeedConnectionAlert(feed, connection, {
            disabledCode: FeedConnectionDisabledCode.Unknown,
          }),
        { message: "SMTP failed" }
      );

      assert.deepStrictEqual(
        ctx.notificationDeliveryAttemptRepository.updateManyByIds.mock.calls[0]?.arguments[1],
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
      const ctx = harness.createContext();

      await ctx.service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.MissingMedium,
      });

      const sendMailCall = ctx.smtpTransport!.sendMail.mock.calls[0]?.arguments[0] as { html: string };
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
      const ctx = harness.createContext();

      await ctx.service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.BadFormat,
      });

      const sendMailCall = ctx.smtpTransport!.sendMail.mock.calls[0]?.arguments[0] as { html: string };
      assert.ok(sendMailCall.html.includes("https://my.test.com/feeds/feed-789"));
      assert.ok(!sendMailCall.html.includes("discord-channel-connections"));
    });

    it("includes article ID and rejected message in template when provided", async () => {
      const feed = createMockFeed();
      const connection = createMockConnection();
      const ctx = harness.createContext();

      await ctx.service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.BadFormat,
        articleId: "article-123",
        rejectedMessage: "Invalid embed structure",
      });

      const sendMailCall = ctx.smtpTransport!.sendMail.mock.calls[0]?.arguments[0] as { html: string };
      assert.ok(sendMailCall.html.includes("article-123") || sendMailCall.html.includes("Invalid embed structure"));
    });

    it("creates delivery attempt with DisabledConnection type", async () => {
      const feed = createMockFeed();
      const connection = createMockConnection();
      const ctx = harness.createContext();

      await ctx.service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.Unknown,
      });

      assert.strictEqual(ctx.notificationDeliveryAttemptRepository.createMany.mock.calls.length, 1);
      const createCall = ctx.notificationDeliveryAttemptRepository.createMany.mock.calls[0]
        ?.arguments[0] as Array<{ type: NotificationDeliveryAttemptType }>;
      assert.strictEqual(createCall[0]?.type, NotificationDeliveryAttemptType.DisabledConnection);
    });

    it("sends to multiple emails when multiple users have alert preferences", async () => {
      const ctx = harness.createContext({
        usersService: { emails: ["user1@test.com", "user2@test.com"] },
      });
      const feed = createMockFeed();
      const connection = createMockConnection();

      await ctx.service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.MissingPermissions,
      });

      const sendMailCall = ctx.smtpTransport!.sendMail.mock.calls[0]?.arguments[0] as { to: string[] };
      assert.deepStrictEqual(sendMailCall.to, ["user1@test.com", "user2@test.com"]);
    });

    it("uses correct reason from constants for each disabled code", async () => {
      const feed = createMockFeed();
      const connection = createMockConnection();
      const ctx = harness.createContext();

      await ctx.service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.MissingMedium,
      });

      const sendMailCall = ctx.smtpTransport!.sendMail.mock.calls[0]?.arguments[0] as { html: string };
      assert.ok(sendMailCall.html.includes("channel with the service provider is missing"));
    });

    it("falls back to disabled code when reason not in constants", async () => {
      const feed = createMockFeed();
      const connection = createMockConnection();
      const ctx = harness.createContext();

      await ctx.service.sendDisabledFeedConnectionAlert(feed, connection, {
        disabledCode: FeedConnectionDisabledCode.Manual,
      });

      const sendMailCall = ctx.smtpTransport!.sendMail.mock.calls[0]?.arguments[0] as { html: string };
      assert.ok(sendMailCall.html.includes("MANUAL"));
    });
  });
});
