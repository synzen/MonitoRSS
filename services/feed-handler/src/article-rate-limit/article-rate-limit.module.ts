import { Module } from "@nestjs/common";
import { DeliveryRecordModule } from "../delivery-record/delivery-record.module";
import { ArticleRateLimitService } from "./article-rate-limit.service";

@Module({
  providers: [ArticleRateLimitService],
  imports: [DeliveryRecordModule],
})
export class ArticleRateLimitModule {}
