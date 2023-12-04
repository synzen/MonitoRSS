import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { FeedsModule } from "../feeds/feeds.module";
import { SupportersModule } from "../supporters/supporters.module";
import { UserFeedFeature } from "../user-feeds/entities";
import { ScheduleEmitterService } from "./schedule-emitter.service";

@Module({
  providers: [ScheduleEmitterService],
  imports: [
    FeedsModule,
    SupportersModule,
    MongooseModule.forFeature([UserFeedFeature]),
  ],
})
export class ScheduleEmitterModule {}
