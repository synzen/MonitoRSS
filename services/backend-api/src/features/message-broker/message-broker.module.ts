import { Module, DynamicModule } from "@nestjs/common";
import config from "../../config/config";
import {
  MessageHandlerErrorBehavior,
  RabbitMQModule,
} from "@golevelup/nestjs-rabbitmq";

@Module({
  providers: [],
  imports: [],
})
export class MessageBrokerModule {
  static forRoot(): DynamicModule {
    const configValues = config();

    return {
      module: MessageBrokerModule,
      imports: [
        RabbitMQModule.forRoot(RabbitMQModule, {
          uri: configValues.BACKEND_API_RABBITMQ_BROKER_URL,
          defaultExchangeType: "direct",
          defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
          channels: {
            default: {
              prefetchCount: 100,
              default: true,
            },
          },
        }),
      ],
      exports: [RabbitMQModule],
    };
  }
}
