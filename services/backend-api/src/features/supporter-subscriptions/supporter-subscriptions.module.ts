import { CacheModule, Module } from "@nestjs/common";
import { SupporterSubscriptionsController } from "./supporter-subscriptions.controller";
import { SupporterSubscriptionsService } from "./supporter-subscriptions.service";

@Module({
  controllers: [SupporterSubscriptionsController],
  providers: [SupporterSubscriptionsService],
  imports: [CacheModule.register({})],
  exports: [],
})
export class SupporterSubscriptionsModule {}
