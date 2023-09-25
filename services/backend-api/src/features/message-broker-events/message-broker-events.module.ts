import { DynamicModule, Module } from "@nestjs/common";
import { MessageBrokerModule } from "../message-broker/message-broker.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SupportersModule } from "../supporters/supporters.module";
import { UserFeedsModule } from "../user-feeds/user-feeds.module";
import { MessageBrokerEventsService } from "./message-broker-events.service";

@Module({
  providers: [],
  imports: [SupportersModule, NotificationsModule.forRoot()],
})
export class MessageBrokerEventsModule {
  static forRoot(): DynamicModule {
    return {
      module: MessageBrokerEventsModule,
      providers: [MessageBrokerEventsService],
      imports: [MessageBrokerModule.forRoot(), UserFeedsModule.forRoot()],
    };
  }
}
