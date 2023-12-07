import {
  RabbitMQModule,
  MessageHandlerErrorBehavior,
  AmqpConnection,
} from '@golevelup/nestjs-rabbitmq';
import { DynamicModule, Module, OnApplicationShutdown } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';
import { AppConfigModule } from '../app-config/app-config.module';
import { MessageBrokerService } from './message-broker.service';

@Module({})
export class MessageBrokerModule implements OnApplicationShutdown {
  static forRoot(): DynamicModule {
    return {
      module: MessageBrokerModule,
      providers: [MessageBrokerService],
      imports: [
        RabbitMQModule.forRootAsync(RabbitMQModule, {
          useFactory: async (appConfigService: AppConfigService) => {
            const rabbitmqUrl = appConfigService.getRabbitMqUrl();

            return {
              uri: rabbitmqUrl,
              defaultExchangeType: 'direct',
              defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
              connectionInitOptions: {
                wait: false,
              },
            };
          },
          inject: [AppConfigService],
          imports: [AppConfigModule.forRoot()],
        }),
      ],
      exports: [RabbitMQModule, MessageBrokerService],
    };
  }

  constructor(private readonly amqp: AmqpConnection) {}

  async onApplicationShutdown() {
    try {
      await this.amqp.managedConnection.close();
    } catch (err) {
      console.error(`Failed to close RabbitMQ connection: ${err}`);
    }
  }
}
