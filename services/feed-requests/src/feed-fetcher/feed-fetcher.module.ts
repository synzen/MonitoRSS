import { DynamicModule, Module } from '@nestjs/common';
import { Request, Response } from './entities';
import { FeedFetcherController } from './feed-fetcher.controller';
import { FeedFetcherService } from './feed-fetcher.service';
import {
  MessageHandlerErrorBehavior,
  RabbitMQModule,
} from '@golevelup/nestjs-rabbitmq';
import config from '../config';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
  controllers: [FeedFetcherController],
  providers: [FeedFetcherService],
  exports: [FeedFetcherService],
  imports: [MikroOrmModule.forFeature([Request, Response])],
})
export class FeedFetcherModule {
  static forRoot(): DynamicModule {
    const configValues = config();

    return {
      module: FeedFetcherModule,
      imports: [
        RabbitMQModule.forRoot(RabbitMQModule, {
          uri: configValues.FEED_REQUESTS_RABBITMQ_BROKER_URL,
          defaultExchangeType: 'direct',
          defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
        }),
      ],
      exports: [RabbitMQModule],
    };
  }
}
