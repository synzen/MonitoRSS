import { Module } from "@nestjs/common";
import { FeedsService } from "./feeds.service";
import { MongooseModule } from "@nestjs/mongoose";
import { FeedFeature } from "./schemas/feed.entity";

@Module({
  providers: [FeedsService],
  imports: [MongooseModule.forFeature([FeedFeature])],
})
export class FeedsModule {}
