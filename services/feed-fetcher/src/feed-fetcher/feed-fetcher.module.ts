import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request, Response } from './entities';
import { FeedFetcherController } from './feed-fetcher.controller';
import { FeedFetcherService } from './feed-fetcher.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FeedsModule } from '../feeds/feeds.module';
import { MessageHandlerErrorBehavior, RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import config from '../config';

@Module({
  controllers: [FeedFetcherController],
  providers: [FeedFetcherService],
  exports: [FeedFetcherService, TypeOrmModule],
  imports: [
    TypeOrmModule.forFeature([Request, Response]),
    EventEmitterModule.forRoot(),
    FeedsModule,
  ],
})
export class FeedFetcherModule {
  static forRoot(): DynamicModule {
    const configValues = config();

    return {
      module: FeedFetcherModule,
      imports: [
        RabbitMQModule.forRoot(RabbitMQModule, {
          uri: configValues.FEED_FETCHER_RABBITMQ_BROKER_URL,
          defaultExchangeType: 'direct',
          defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
          exchanges: [
            {
              name: 'url.fetch.dlx',
              type: 'direct',
            },
          ],
        }),
      ],
      exports: [RabbitMQModule],
    };
  }
}
