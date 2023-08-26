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

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(SmtpTransport)
    private readonly smtpTransport: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null,
    private readonly usersService: UsersService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel
  ) {}

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
      .select("title user shareManageOptions")
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
              `No emails found to send disabled feed alert to for feed ids ${feedIds.join(
                ","
              )}`
            );

            return;
          }

          return await this.smtpTransport?.sendMail({
            from: '"MonitoRSS Alerts" <noreply@monitorss.xyz>',
            to: emails,
            subject: `Disabled feed: ${feed.title}`,
            html: `<p>The feed <strong>${feed.title}</strong> has been disabled for the following reason:</p><p>${data.reason}</p>`,
          });
        } catch (err) {
          logger.error(
            "Failed to send disabled feed alert email in notifications service",
            {
              error: err,
            }
          );
        }
      })
    );
  }
}
