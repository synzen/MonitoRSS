import { Module, DynamicModule } from "@nestjs/common";
import {
  MessageHandlerErrorBehavior,
  RabbitMQModule,
} from "@golevelup/nestjs-rabbitmq";
import { config } from "../config";

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
          uri: configValues.USER_FEEDS_RABBITMQ_BROKER_URL,
          defaultExchangeType: "direct",
          defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
        }),
      ],
      exports: [RabbitMQModule],
    };
  }
}
