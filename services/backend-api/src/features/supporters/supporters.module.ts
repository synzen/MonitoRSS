import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CustomerFeature } from "./entities/customer.entity";
import { PatronFeature } from "./entities/patron.entity";
import { SupporterFeature } from "./entities/supporter.entity";
import { UserFeedLimitOverrideFeature } from "./entities/user-feed-limit-overrides.entity";
import { GuildSubscriptionsService } from "./guild-subscriptions.service";
import { PatronsService } from "./patrons.service";
import { SupportersService } from "./supporters.service";

@Module({
  providers: [SupportersService, PatronsService, GuildSubscriptionsService],
  imports: [
    MongooseModule.forFeature([
      SupporterFeature,
      PatronFeature,
      UserFeedLimitOverrideFeature,
      CustomerFeature,
    ]),
  ],
  exports: [SupportersService, MongooseModule.forFeature([SupporterFeature])],
})
export class SupportersModule {}
