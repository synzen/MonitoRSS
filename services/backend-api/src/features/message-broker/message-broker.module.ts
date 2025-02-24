import { Module, DynamicModule, OnApplicationShutdown } from "@nestjs/common";
import config from "../../config/config";
import {
  AmqpConnection,
  MessageHandlerErrorBehavior,
  RabbitMQModule,
} from "@golevelup/nestjs-rabbitmq";
import logger from "../../utils/logger";
import { MessageBrokerService } from "./message-broker.service";

@Module({
  providers: [MessageBrokerService],
  imports: [
    RabbitMQModule.forRootAsync({
      useFactory: () => {
        const configValues = config();

        return {
          uri: configValues.BACKEND_API_RABBITMQ_BROKER_URL,
          connectionInitOptions: {
            wait: false,
          },
          connectionManagerOptions: {
            heartbeatIntervalInSeconds: 0,
            reconnectTimeInSeconds: 5,
          },
          defaultExchangeType: "direct",
          defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.ACK,
          channels: {
            default: {
              prefetchCount: 100,
              default: true,
            },
          },
        };
      },
    }),
  ],
  exports: [RabbitMQModule, MessageBrokerService],
})
export class MessageBrokerModule implements OnApplicationShutdown {
  static forRoot(): DynamicModule {
    return {
      module: MessageBrokerModule,
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
