import { Module, DynamicModule } from "@nestjs/common";
import { SupportersModule } from "../supporters/supporters.module";
import { ScheduleHandlerService } from "./schedule-handler.service";
import { MessageBrokerModule } from "../message-broker/message-broker.module";
import { UserFeedsModule } from "../user-feeds/user-feeds.module";

@Module({
  providers: [ScheduleHandlerService],
  imports: [SupportersModule],
})
export class ScheduleHandlerModule {
  static forRoot(): DynamicModule {
    return {
      module: ScheduleHandlerModule,
      imports: [MessageBrokerModule.forRoot(), UserFeedsModule.forRoot()],
    };
  }
}
