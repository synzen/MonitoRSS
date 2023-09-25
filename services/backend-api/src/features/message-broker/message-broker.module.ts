import { Module, DynamicModule, OnApplicationShutdown } from "@nestjs/common";
import config from "../../config/config";
import {
  AmqpConnection,
  MessageHandlerErrorBehavior,
  RabbitMQModule,
} from "@golevelup/nestjs-rabbitmq";
import logger from "../../utils/logger";

@Module({
  providers: [],
  imports: [],
})
export class MessageBrokerModule implements OnApplicationShutdown {
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

  constructor(private readonly amqp: AmqpConnection) {}

  async onApplicationShutdown(signal?: string | undefined) {
    logger.info(`Received ${signal}. Shutting down amqp connection...`);

    try {
      await this.amqp.managedConnection.close();
      logger.info(`Successfully closed amqp connection`);
    } catch (err) {
      logger.error("Failed to close AMQP connection", {
        error: (err as Error).stack,
      });
    }
  }
}
