import { Module, DynamicModule } from "@nestjs/common";
import config from "../../config/config";
import { FeedsModule } from "../feeds/feeds.module";
import { SupportersModule } from "../supporters/supporters.module";
import { ScheduleHandlerService } from "./schedule-handler.service";
import {
  MessageHandlerErrorBehavior,
  RabbitMQModule,
} from "@golevelup/nestjs-rabbitmq";

@Module({
  providers: [ScheduleHandlerService],
  imports: [SupportersModule, FeedsModule],
})
export class ScheduleHandlerModule {
  static forRoot(): DynamicModule {
    const configValues = config();

    return {
      module: ScheduleHandlerModule,
      imports: [
        RabbitMQModule.forRoot(RabbitMQModule, {
          uri: configValues.BACKEND_API_RABBITMQ_BROKER_URL,
          defaultExchangeType: "direct",
          defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
        }),
      ],
      exports: [RabbitMQModule],
    };
  }
}
