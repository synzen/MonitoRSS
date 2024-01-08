import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserFeedFeature } from "../user-feeds/entities";
import { UserFeedConnectionEventsService } from "./user-feed-connection-events.service";

@Module({
  controllers: [],
  providers: [UserFeedConnectionEventsService],
  imports: [MongooseModule.forFeature([UserFeedFeature])],
  exports: [UserFeedConnectionEventsService],
})
export class UserFeedConnectionEventsModule {}
