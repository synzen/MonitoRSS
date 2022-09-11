import { Module } from "@nestjs/common";
import { ArticleFiltersModule } from "../article-filters/article-filters.module";
import { DeliveryService } from "./delivery.service";
import { DiscordMediumService } from "./mediums/discord-medium.service";

@Module({
  controllers: [],
  providers: [DeliveryService, DiscordMediumService],
  imports: [ArticleFiltersModule],
})
export class DeliveryModule {}
