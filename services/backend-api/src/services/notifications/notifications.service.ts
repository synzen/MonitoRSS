import Handlebars from "handlebars";
import type { Config } from "../../config";
import type { SmtpTransport } from "../../infra/smtp";
import type { INotificationDeliveryAttemptRepository } from "../../repositories/interfaces/notification-delivery-attempt.types";
import type {
  IUserFeed,
  IUserFeedRepository,
  UserFeedForNotification,
} from "../../repositories/interfaces/user-feed.types";
import type { IDiscordChannelConnection } from "../../repositories/interfaces/feed-connection.types";
import {
  UserFeedDisabledCode,
  FeedConnectionDisabledCode,
  NotificationDeliveryAttemptStatus,
  NotificationDeliveryAttemptType,
  UserFeedManagerStatus,
} from "../../repositories/shared/enums";
import type { UsersService } from "../users/users.service";
import logger from "../../infra/logger";
import DISABLED_FEED_TEMPLATE from "./disabled-feed.template";
import {
  USER_FEED_DISABLED_REASONS,
  USER_FEED_CONNECTION_DISABLED_REASONS,
} from "./constants";

const disabledFeedTemplate = Handlebars.compile(DISABLED_FEED_TEMPLATE);

function truncateString(str: string, maxLength: number): string {
  if (str.length > maxLength) {
    return str.slice(0, maxLength) + "...";
  }
  return str;
}

export interface NotificationsServiceDeps {
  config: Config;
  smtpTransport: SmtpTransport;
  usersService: UsersService;
  userFeedRepository: IUserFeedRepository;
  notificationDeliveryAttemptRepository: INotificationDeliveryAttemptRepository;
}

export class NotificationsService {
  private emailAlertFrom: string;
  private loginRedirectUrl: string;

  constructor(private readonly deps: NotificationsServiceDeps) {
    this.emailAlertFrom =
      deps.config.BACKEND_API_SMTP_FROM ||
      '"MonitoRSS Alerts" <alerts@monitorss.xyz>';
    this.loginRedirectUrl =
      deps.config.BACKEND_API_LOGIN_REDIRECT_URI || "https://my.monitorss.xyz";
  }

  async sendDisabledFeedsAlert(
    feedIds: string[],
    data: { disabledCode: UserFeedDisabledCode },
  ): Promise<void> {
    const feeds =
      await this.deps.userFeedRepository.findByIdsForNotification(feedIds);

    await Promise.all(
      feeds.map(async (feed) => {
        try {
          await this.sendDisabledFeedAlertForFeed(feed, data.disabledCode);
        } catch (err) {
          logger.error(
            `Failed to send disabled feed alert email for feed ${feed.id}`,
            { stack: (err as Error).stack },
          );
        }
      }),
    );
  }

  private async sendDisabledFeedAlertForFeed(
    feed: UserFeedForNotification,
    disabledCode: UserFeedDisabledCode,
  ): Promise<void> {
    const discordUserIdsToAlert = this.getDiscordUserIdsToAlert(feed);
    const emails = await this.deps.usersService.getEmailsForAlerts(
      discordUserIdsToAlert,
    );

    if (!emails.length) {
      logger.debug(
        `No emails found to send disabled feed alert for feed ${feed.id}`,
      );
      return;
    }

    const attemptIds = await this.createDeliveryAttempts(
      emails,
      NotificationDeliveryAttemptType.DisabledFeed,
      feed.id,
    );

    const reason = USER_FEED_DISABLED_REASONS[disabledCode];
    const templateData = {
      feedName: truncateString(feed.title, 50),
      feedUrlDisplay: truncateString(feed.url, 50),
      feedUrlLink: feed.url,
      controlPanelUrl: `${this.loginRedirectUrl}/feeds/${feed.id}`,
      reason: reason?.reason || disabledCode,
      actionRequired: reason?.action,
      manageNotificationsUrl: `${this.loginRedirectUrl}/alerting`,
    };

    try {
      await this.deps.smtpTransport?.sendMail({
        from: this.emailAlertFrom,
        to: emails,
        subject: `Feed has been disabled: ${feed.title}`,
        html: disabledFeedTemplate(templateData),
      });

      await this.updateDeliveryAttemptStatus(
        attemptIds,
        NotificationDeliveryAttemptStatus.Success,
      );
    } catch (err) {
      await this.updateDeliveryAttemptStatus(
        attemptIds,
        NotificationDeliveryAttemptStatus.Failure,
        (err as Error).message,
      );
      throw err;
    }
  }

  async sendDisabledFeedConnectionAlert(
    feed: IUserFeed,
    connection: IDiscordChannelConnection,
    options: {
      disabledCode: FeedConnectionDisabledCode;
      articleId?: string;
      rejectedMessage?: string;
    },
  ): Promise<void> {
    const discordUserIdsToAlert = this.getDiscordUserIdsToAlert(feed);
    const emails = await this.deps.usersService.getEmailsForAlerts(
      discordUserIdsToAlert,
    );

    if (!emails.length) {
      logger.debug(
        `No emails found to send disabled feed connection alert for feed ${feed.id}`,
      );
      return;
    }

    const attemptIds = await this.createDeliveryAttempts(
      emails,
      NotificationDeliveryAttemptType.DisabledConnection,
      feed.id,
    );

    const reason = USER_FEED_CONNECTION_DISABLED_REASONS[options.disabledCode];
    const connectionPrefix = this.getConnectionPrefix(feed, connection);

    const templateData = {
      feedName: truncateString(feed.title, 50),
      feedUrlDisplay: truncateString(feed.url, 50),
      feedUrlLink: feed.url,
      controlPanelUrl: `${this.loginRedirectUrl}/feeds/${feed.id}${
        connectionPrefix ? `/${connectionPrefix}/${connection.id}` : ""
      }`,
      reason: reason?.reason || options.disabledCode,
      actionRequired: reason?.action,
      connectionName: truncateString(connection.name, 50),
      manageNotificationsUrl: `${this.loginRedirectUrl}/settings`,
      articleId: options.articleId,
      rejectedMessage: options.rejectedMessage,
    };

    try {
      await this.deps.smtpTransport?.sendMail({
        from: this.emailAlertFrom,
        to: emails,
        subject: `Feed connection has been disabled: ${connection.name} (feed: ${feed.title})`,
        html: disabledFeedTemplate(templateData),
      });

      await this.updateDeliveryAttemptStatus(
        attemptIds,
        NotificationDeliveryAttemptStatus.Success,
      );
    } catch (err) {
      await this.updateDeliveryAttemptStatus(
        attemptIds,
        NotificationDeliveryAttemptStatus.Failure,
        (err as Error).message,
      );
      throw err;
    }
  }

  private getDiscordUserIdsToAlert(feed: UserFeedForNotification): string[] {
    const acceptedInviteUserIds =
      feed.shareManageOptions?.invites
        .filter((i) => i.status === UserFeedManagerStatus.Accepted)
        .map((i) => i.discordUserId) || [];

    return [...acceptedInviteUserIds, feed.user.discordUserId];
  }

  private getConnectionPrefix(
    feed: IUserFeed,
    connection: IDiscordChannelConnection,
  ): string {
    const isDiscordChannel = feed.connections.discordChannels.some(
      (c) => c.id === connection.id,
    );

    if (isDiscordChannel) {
      return "discord-channel-connections";
    }

    return "";
  }

  private async createDeliveryAttempts(
    emails: string[],
    type: NotificationDeliveryAttemptType,
    feedId: string,
  ): Promise<string[]> {
    try {
      const attempts =
        await this.deps.notificationDeliveryAttemptRepository.createMany(
          emails.map((email) => ({
            email,
            status: NotificationDeliveryAttemptStatus.Pending,
            type,
            feedId,
          })),
        );
      return attempts.map((a) => a.id);
    } catch (err) {
      logger.error(
        `Failed to create notification delivery attempts for feed ${feedId}`,
        { stack: (err as Error).stack },
      );
      return [];
    }
  }

  private async updateDeliveryAttemptStatus(
    attemptIds: string[],
    status: NotificationDeliveryAttemptStatus,
    failReason?: string,
  ): Promise<void> {
    if (attemptIds.length === 0) {
      return;
    }

    try {
      await this.deps.notificationDeliveryAttemptRepository.updateManyByIds(
        attemptIds,
        { status, failReasonInternal: failReason },
      );
    } catch (err) {
      logger.error(`Failed to update notification delivery attempt status`, {
        stack: (err as Error).stack,
      });
    }
  }
}
