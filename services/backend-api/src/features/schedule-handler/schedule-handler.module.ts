import { Module, DynamicModule } from "@nestjs/common";
import { FeedsModule } from "../feeds/feeds.module";
import { SupportersModule } from "../supporters/supporters.module";
import { ScheduleHandlerService } from "./schedule-handler.service";
import { MessageBrokerModule } from "../message-broker/message-broker.module";

@Module({
  providers: [ScheduleHandlerService],
  imports: [SupportersModule, FeedsModule],
})
export class ScheduleHandlerModule {
  static forRoot(): DynamicModule {
    return {
      module: ScheduleHandlerModule,
      imports: [MessageBrokerModule.forRoot()],
    };
  }
}
