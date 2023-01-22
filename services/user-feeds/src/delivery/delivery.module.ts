import { Module } from "@nestjs/common";
import { ArticleFiltersModule } from "../article-filters/article-filters.module";
import { ArticleFormatterModule } from "../article-formatter/article-formatter.module";
import { ArticleRateLimitModule } from "../article-rate-limit/article-rate-limit.module";
import { DeliveryService } from "./delivery.service";
import { DiscordMediumService } from "./mediums/discord-medium.service";

@Module({
  controllers: [],
  providers: [DeliveryService, DiscordMediumService],
  imports: [
    ArticleFiltersModule,
    ArticleRateLimitModule,
    ArticleFormatterModule,
  ],
  exports: [DeliveryService],
})
export class DeliveryModule {}
