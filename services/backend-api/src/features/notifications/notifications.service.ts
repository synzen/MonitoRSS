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

const disabledFeedHandlebarsText = fs.readFileSync(
  join(__dirname, "handlebars-templates", "disabled-feed.hbs"),
  "utf8"
);

const disabledFeedTemplate = Handlebars.compile(disabledFeedHandlebarsText);

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(SmtpTransport)
    private readonly smtpTransport: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null,
    private readonly usersService: UsersService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel
  ) {}

  static EMAIL_ALERT_FROM = '"MonitoRSS Alerts" <alerts@monitorss.xyz>';

  async sendDisabledFeedsAlert(
    feedIds: Types.ObjectId[],
    data: { reason: string }
  ) {
    const feeds = await this.userFeedModel
      .find({
        _id: {
          $in: feedIds,
        },
      })
      .select("_id title user shareManageOptions")
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

          const templateData = {
            feedName: feed.title,
            feedUrl: feed.url,
            controlPanelUrl: `https://my.monitorss.xyz`,
            reason: data.reason,
            manageNotificationsUrl: "https://my.monitorss.xyz",
          };

          return await this.smtpTransport?.sendMail({
            from: NotificationsService.EMAIL_ALERT_FROM,
            to: emails,
            subject: `Feed has been disabled: ${feed.title}`,
            html: disabledFeedTemplate(templateData),
          });
        } catch (err) {
          logger.error(
            "Failed to send disabled feed alert email in notifications service",
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
    data: { reason: string }
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

    const templateData = {
      feedName: feed.title,
      feedUrl: feed.url,
      controlPanelUrl: `https://my.monitorss.xyz`,
      reason: data.reason,
      connectionName: connection.name,
      manageNotificationsUrl: "https://my.monitorss.xyz",
    };

    return await this.smtpTransport?.sendMail({
      from: NotificationsService.EMAIL_ALERT_FROM,
      to: emails,
      subject: `Feed connection has been disabled: ${connection.name} (feed: ${feed.title})`,
      html: disabledFeedTemplate(templateData),
    });
  }
}
