import { DynamicModule, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SmtpTransport } from "./constants/smtp-transport.constants";
import { NotificationsService } from "./notifications.service";
import nodemailer from "nodemailer";
import { UsersModule } from "../users/users.module";
import { MongooseModule } from "@nestjs/mongoose";
import { UserFeedFeature } from "../user-feeds/entities";
import { NotificationDeliveryAttemptFeature } from "./entities/notification-delivery-attempt.entity";

@Module({
  providers: [
    NotificationsService,
    {
      provide: SmtpTransport,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get("BACKEND_API_SMTP_HOST");
        const username = configService.get("BACKEND_API_SMTP_USERNAME");
        const password = configService.get("BACKEND_API_SMTP_PASSWORD");

        if (!host || !username || !password) {
          return null;
        }

        return nodemailer.createTransport({
          host,
          port: 465,
          secure: true,
          auth: {
            user: username,
            pass: password,
          },
        });
      },
    },
  ],
  exports: [NotificationsService],
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      UserFeedFeature,
      NotificationDeliveryAttemptFeature,
    ]),
  ],
})
export class NotificationsModule {
  static forRoot(): DynamicModule {
    return {
      module: NotificationsModule,
      imports: [],
    };
  }
}
