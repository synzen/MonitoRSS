import { Module, OnApplicationShutdown } from "@nestjs/common";
import { ArticleFiltersModule } from "../article-filters/article-filters.module";
import { ArticleFormatterModule } from "../article-formatter/article-formatter.module";
import { ArticleRateLimitModule } from "../article-rate-limit/article-rate-limit.module";
import { CacheStorageModule } from "../cache-storage/cache-storage.module";
import logger from "../shared/utils/logger";
import { DeliveryService } from "./delivery.service";
import { DiscordMediumService } from "./mediums/discord-medium.service";
// eslint-disable-next-line max-len
import { DiscordApiClientService } from "./mediums/discord/services/discord-api-client.service";
// eslint-disable-next-line max-len
import { DiscordDeliveryResultService } from "./mediums/discord/services/discord-delivery-result.service";
// eslint-disable-next-line max-len
import { DiscordMessageEnqueueService } from "./mediums/discord/services/discord-message-enqueue.service";
// eslint-disable-next-line max-len
import { DiscordPayloadBuilderService } from "./mediums/discord/services/discord-payload-builder.service";

@Module({
  controllers: [],
  providers: [
    DeliveryService,
    DiscordMediumService,
    DiscordApiClientService,
    DiscordDeliveryResultService,
    DiscordMessageEnqueueService,
    DiscordPayloadBuilderService,
  ],
  imports: [
    ArticleFiltersModule,
    ArticleRateLimitModule,
    ArticleFormatterModule,
    CacheStorageModule,
  ],
  exports: [
    DeliveryService,
    DiscordMediumService,
    DiscordApiClientService,
    DiscordDeliveryResultService,
    DiscordMessageEnqueueService,
    DiscordPayloadBuilderService,
  ],
})
export class DeliveryModule implements OnApplicationShutdown {
  constructor(private readonly discordMediumService: DiscordMediumService) {}

  async onApplicationShutdown(): Promise<void> {
    await this.discordMediumService.close();
    logger.info("Discord medium service closed");
  }
}
