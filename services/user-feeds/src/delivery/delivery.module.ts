import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RESTProducer } from "@synzen/discord-rest";
import { ArticleFiltersModule } from "../article-filters/article-filters.module";
import { ArticleRateLimitModule } from "../article-rate-limit/article-rate-limit.module";
import { DeliveryService } from "./delivery.service";
import { DiscordMediumService } from "./mediums/discord-medium.service";

@Module({
  controllers: [],
  providers: [
    {
      provide: "DISCORD_REST_PRODUCER",
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const rabbitmqUri = configService.getOrThrow(
          "FEED_HANDLER_DISCORD_RABBITMQ_URI"
        );
        const discordClientId = configService.getOrThrow(
          "FEED_HANDLER_DISCORD_CLIENT_ID"
        );

        const producer = new RESTProducer(rabbitmqUri, {
          clientId: discordClientId,
        });

        await producer.initialize();

        return producer;
      },
    },
    DeliveryService,
    DiscordMediumService,
  ],
  imports: [ArticleFiltersModule, ArticleRateLimitModule],
  exports: [DeliveryService],
})
export class DeliveryModule {}
