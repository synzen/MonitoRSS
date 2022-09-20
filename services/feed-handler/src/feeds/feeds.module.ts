import { Module } from "@nestjs/common";
import { FeedsService } from "./feeds.service";
import { FeedsController } from "./feeds.controller";
import { ArticleRateLimitModule } from "../article-rate-limit/article-rate-limit.module";

@Module({
  controllers: [FeedsController],
  providers: [FeedsService],
  imports: [ArticleRateLimitModule],
})
export class FeedsModule {}
