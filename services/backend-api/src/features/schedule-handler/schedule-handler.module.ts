import { Module, DynamicModule } from "@nestjs/common";
import { SqsPollingService } from "../../common/services/sqs-polling.service";
import config from "../../config/config";
import { FeedsModule } from "../feeds/feeds.module";
import { SupportersModule } from "../supporters/supporters.module";
import { ScheduleHandlerService } from "./schedule-handler.service";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
@Module({
  providers: [ScheduleHandlerService, SqsPollingService],
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
        }),
      ],
      exports: [RabbitMQModule],
    };
  }
}
