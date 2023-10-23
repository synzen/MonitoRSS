import { Inject, Injectable } from "@nestjs/common";
import { SmtpTransport } from "./constants/smtp-transport.constants";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { UserFeedManagerStatus } from "../user-feed-management-invites/constants";
import { InjectModel } from "@nestjs/mongoose";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import { Types } from "mongoose";
import { UsersService } from "../users/users.service";
import logger from "../../utils/logger";
import {
  DiscordChannelConnection,
  DiscordWebhookConnection,
} from "../feeds/entities/feed-connections";
import fs from "fs";
import { join } from "path";
import Handlebars from "handlebars";
import { UserFeedDisabledCode } from "../user-feeds/types";
import { FeedConnectionDisabledCode } from "../feeds/constants";
import {
  NotificationDeliveryAttempt,
  NotificationDeliveryAttemptModel,
} from "./entities/notification-delivery-attempt.entity";
import { NotificationDeliveryAttemptStatus } from "./constants/notification-delivery-attempt-status.constants";
import { NotificationDeliveryAttemptType } from "./constants/notification-delivery-attempt-type.constants";

const disabledFeedHandlebarsText = fs.readFileSync(
  join(__dirname, "handlebars-templates", "disabled-feed.hbs"),
  "utf8"
);

const disabledFeedTemplate = Handlebars.compile(disabledFeedHandlebarsText);

const USER_FEED_DISABLED_REASONS: Partial<
  Record<UserFeedDisabledCode, { reason: string; action: string }>
> = {
  [UserFeedDisabledCode.ExceededFeedLimit]: {
    reason: "Exceeded feed limit",
    action:
      "Remove some feeds or become a supporter to get an increased feed limit.",
  },
  [UserFeedDisabledCode.FailedRequests]: {
    reason: "Too many failed attempts to fetch feed",
    action:
      "Check that the feed is still valid by using online validators or by clicking the feed link." +
      " If it is valid, try re-enabling it in the control panel.",
  },
  [UserFeedDisabledCode.FeedTooLarge]: {
    reason: "Too large to be processed",
    action:
      "Consider an alternative feed with fewer articles. If you are the feed owner, consider reducing the number of items in the feed." +
      " If you believe this is a mistake, please contact support.",
  },
  [UserFeedDisabledCode.InvalidFeed]: {
    reason: "Not a valid RSS XML feed",
    action:
      "Check that the feed is still valid by using online validators or by clicking the feed link." +
      " If it is valid, try re-enabling it in the control panel.",
  },
};

const USER_FEED_CONNECTION_DISABLED_REASONS: Partial<
  Record<FeedConnectionDisabledCode, { reason: string; action: string }>
> = {
  [FeedConnectionDisabledCode.BadFormat]: {
    reason: "Message payload was rejected due to malformed input",
    action:
      "Change your message customization settings to make sure it generally works by sending test articles" +
      ", specifically the latest articles on the feed.",
  },
  [FeedConnectionDisabledCode.MissingMedium]: {
    reason: "The channel with the service provider is missing",
    action: "Re-target the feed connection to a working channel.",
  },
  [FeedConnectionDisabledCode.MissingPermissions]: {
    reason: "Service provider rejected message due to lack of permissions",
    action:
      "Ensure the bot has all required permissions to deliver articles to the service provider.",
  },
  [FeedConnectionDisabledCode.Unknown]: {
    reason: "Unknown error",
    action: "Contact support.",
  },
};

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(SmtpTransport)
    private readonly smtpTransport: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null,
    private readonly usersService: UsersService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    @InjectModel(NotificationDeliveryAttempt.name)
    private readonly notificationDeliveryAttemptModel: NotificationDeliveryAttemptModel
  ) {}

  static EMAIL_ALERT_FROM = '"MonitoRSS Alerts" <alerts@monitorss.xyz>';

  async sendDisabledFeedsAlert(
    feedIds: Types.ObjectId[],
    data: { disabledCode: UserFeedDisabledCode }
  ) {
    const feeds = await this.userFeedModel
      .find({
        _id: {
          $in: feedIds,
        },
      })
      .select("_id title user shareManageOptions url")
      .lean();

    await Promise.all(
      feeds.map(async (feed) => {
        try {
          const discordUserIdsToAlert = [
            ...(feed.shareManageOptions?.invites
              .filter((i) => i.status === UserFeedManagerStatus.Accepted)
              .map((i) => i.discordUserId) || []),
            feed.user.discordUserId,
          ];

          const emails = await this.usersService.getEmailsForAlerts(
            discordUserIdsToAlert
          );

          if (!emails.length) {
            logger.debug(
              `No emails found to send disabled feed alert to for feed id ${feed._id}`
            );

            return;
          }

          let createdAttemptIds: Types.ObjectId[] = [];

          try {
            const created = await this.notificationDeliveryAttemptModel.create(
              emails.map((e) => ({
                email: e,
                status: NotificationDeliveryAttemptStatus.Pending,
                type: NotificationDeliveryAttemptType.DisabledFeed,
                feedId: feed._id,
              }))
            );

            createdAttemptIds = created.map((c) => c._id);
          } catch (err) {
            logger.error(
              `Failed to create notification delivery attempts in notifications service for feed ${feed._id}`,
              {
                stack: (err as Error).stack,
              }
            );
          }

          const reason = USER_FEED_DISABLED_REASONS[data.disabledCode];

          let feedName = feed.title;

          if (feedName.length > 50) {
            feedName = feedName.slice(0, 50) + "...";
          }

          let feedUrl = feed.url;

          if (feedUrl.length > 50) {
            feedUrl = feedUrl.slice(0, 50) + "...";
          }

          const templateData = {
            feedName,
            feedUrlDisplay: feedUrl,
            feedUrlLink: feed.url,
            controlPanelUrl: `https://my.monitorss.xyz/feeds/${feed._id}`,
            reason: reason?.reason || data.disabledCode,
            actionRequired: reason?.action,
            manageNotificationsUrl: "https://my.monitorss.xyz/alerting",
          };

          const results = await this.smtpTransport?.sendMail({
            from: NotificationsService.EMAIL_ALERT_FROM,
            to: emails,
            subject: `Feed has been disabled: ${feed.title}`,
            html: disabledFeedTemplate(templateData),
          });

          if (createdAttemptIds) {
            try {
              await this.notificationDeliveryAttemptModel.updateMany(
                {
                  _id: {
                    $in: createdAttemptIds,
                  },
                },
                {
                  $set: {
                    status: NotificationDeliveryAttemptStatus.Success,
                  },
                }
              );
            } catch (err) {
              logger.error(
                `Failed to update notification delivery attempts in notifications service for feed ${feed._id} for disabled feed`,
                {
                  stack: (err as Error).stack,
                }
              );
            }
          }

          return results;
        } catch (err) {
          logger.error(
            `Failed to send disabled feed alert email in notifications service for feed ${feed._id} for disabled feed`,
            {
              stack: (err as Error).stack,
            }
          );
        }
      })
    );
  }

  async sendDisabledFeedConnectionAlert(
    feed: UserFeed,
    connection: DiscordChannelConnection | DiscordWebhookConnection,
    {
      disabledCode,
      articleId,
      rejectedMessage,
    }: {
      disabledCode: FeedConnectionDisabledCode;
      articleId?: string;
      rejectedMessage?: string;
    }
  ) {
    const discordUserIdsToAlert = [
      ...(feed.shareManageOptions?.invites
        .filter((i) => i.status === UserFeedManagerStatus.Accepted)
        .map((i) => i.discordUserId) || []),
      feed.user.discordUserId,
    ];

    const emails = await this.usersService.getEmailsForAlerts(
      discordUserIdsToAlert
    );

    if (!emails.length) {
      logger.debug(
        `No emails found to send disabled feed connection alert to for feed id ${feed._id}`
      );

      return;
    }

    let createdAttemptIds: Types.ObjectId[] = [];

    try {
      const created = await this.notificationDeliveryAttemptModel.create(
        emails.map((e) => ({
          email: e,
          status: NotificationDeliveryAttemptStatus.Pending,
          type: NotificationDeliveryAttemptType.DisabledConnection,
          feedId: feed._id,
        }))
      );

      createdAttemptIds = created.map((c) => c._id);
    } catch (err) {
      logger.error(
        `Failed to create notification delivery attempts in notifications service for feed ${feed._id} for disabled connection`,
        {
          stack: (err as Error).stack,
        }
      );
    }

    const reason = USER_FEED_CONNECTION_DISABLED_REASONS[disabledCode];

    let feedName = feed.title;

    if (feedName.length > 50) {
      feedName = feedName.slice(0, 50) + "...";
    }

    let feedUrl = feed.url;

    if (feedUrl.length > 50) {
      feedUrl = feedUrl.slice(0, 50) + "...";
    }

    let connectionName = connection.name;

    if (connectionName.length > 50) {
      connectionName = connectionName.slice(0, 50) + "...";
    }

    let connectionPrefix = "";

    if (
      feed.connections.discordChannels.find((c) => c.id.equals(connection.id))
    ) {
      connectionPrefix = "discord-channel-connections";
    } else if (
      feed.connections.discordWebhooks.find((c) => c.id.equals(connection.id))
    ) {
      connectionPrefix = "discord-webhook-connections";
    }

    const templateData = {
      feedName: feedName,
      feedUrlDisplay: feedUrl,
      feedUrlLink: feed.url,
      controlPanelUrl: `https://my.monitorss.xyz/feeds/${feed._id}${
        connectionPrefix ? `/${connectionPrefix}/${connection.id}` : ""
      }`,
      reason: reason?.reason || disabledCode,
      actionRequired: reason?.action,
      connectionName: connectionName,
      manageNotificationsUrl: "https://my.monitorss.xyz/alerting",
      articleId,
      rejectedMessage,
    };

    const results = await this.smtpTransport?.sendMail({
      from: NotificationsService.EMAIL_ALERT_FROM,
      to: emails,
      subject: `Feed connection has been disabled: ${connection.name} (feed: ${feed.title})`,
      html: disabledFeedTemplate(templateData),
    });

    if (createdAttemptIds) {
      try {
        await this.notificationDeliveryAttemptModel.updateMany(
          {
            _id: {
              $in: createdAttemptIds,
            },
          },
          {
            $set: {
              status: NotificationDeliveryAttemptStatus.Success,
            },
          }
        );
      } catch (err) {
        logger.error(
          `Failed to update notification delivery attempts in notifications service for feed ${feed._id} for disabled connection`,
          {
            stack: (err as Error).stack,
          }
        );
      }
    }

    return results;
  }
}
