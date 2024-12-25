/* eslint-disable max-len */
import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { join } from "path";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import config from "./config/config";
import testConfig from "./config/test-config";
import { DiscordAuthModule } from "./features/discord-auth/discord-auth.module";
import { DiscordServersModule } from "./features/discord-servers/discord-servers.module";
import { DiscordUserModule } from "./features/discord-users/discord-users.module";
import { DiscordWebhooksModule } from "./features/discord-webhooks/discord-webhooks.module";
import { FeedsModule } from "./features/feeds/feeds.module";
import { SupportersModule } from "./features/supporters/supporters.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ScheduleEmitterModule } from "./features/schedule-emitter/schedule-emitter.module";
import { FeedConnectionsDiscordChannelsModule } from "./features/feed-connections/feed-connections-discord-channels.module";
import { FeedConnectionsDiscordWebhooksModule } from "./features/feed-connections/feed-connections-discord-webhooks.module";
import { ScheduleHandlerModule } from "./features/schedule-handler/schedule-handler.module";
import { LegacyFeedConversionModule } from "./features/legacy-feed-conversion/legacy-feed-conversion.module";
import { UserFeedManagementInvitesModule } from "./features/user-feed-management-invites/user-feed-management-invites.module";
import { ErrorReportsController } from "./error-reports.controller";
import { MessageBrokerEventsModule } from "./features/message-broker-events/message-broker-events.module";
import { SupporterSubscriptionsModule } from "./features/supporter-subscriptions/supporter-subscriptions.module";
import { MongoMigrationsModule } from "./features/mongo-migrations/mongo-migrations.module";
import logger from "./utils/logger";
import { RedditApiModule } from "./services/apis/reddit/reddit-api.module";
import { RedditLoginModule } from "./features/reddit-login/reddit-login.module";

@Module({
  imports: [
    DiscordAuthModule,
    DiscordUserModule,
    DiscordServersModule,
    FeedsModule,
    DiscordWebhooksModule,
    SupportersModule,
    LegacyFeedConversionModule,
    ScheduleEmitterModule,
    UserFeedManagementInvitesModule.forRoot(),
    MongoMigrationsModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "client", "dist"),
    }),
  ],
  controllers: [AppController, ErrorReportsController],
  providers: [AppService],
})
export class AppModule {
  static forRoot(): DynamicModule {
    const configValues = config();

    const mongoUri = new URL(configValues.BACKEND_API_MONGODB_URI);
    logger.debug(`Connecting to MongoDB at ${mongoUri.host}`);

    return {
      module: AppModule,
      imports: [
        MongooseModule.forRoot(configValues.BACKEND_API_MONGODB_URI, {
          autoIndex: true,
          readPreference: "primary",
        }),
        FeedConnectionsDiscordWebhooksModule.forRoot(),
        FeedConnectionsDiscordChannelsModule.forRoot(),
        SupporterSubscriptionsModule.forRoot(),
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          ignoreEnvFile: true,
          load: [process.env.NODE_ENV === "test" ? testConfig : config],
        }),
      ],
    };
  }

  static forApi(): DynamicModule {
    const original = this.forRoot();

    return {
      ...original,
      imports: [
        ...(original.imports || []),
        MessageBrokerEventsModule.forRoot(),
        RedditLoginModule,
      ],
    };
  }

  static forScheduleEmitter(): DynamicModule {
    const original = this.forRoot();

    return {
      ...original,
      imports: [
        ...(original.imports || []),
        ScheduleHandlerModule.forRoot(),
        RedditApiModule,
      ],
    };
  }

  static forTest(): DynamicModule {
    return {
      module: AppModule,
      imports: [],
    };
  }
}
