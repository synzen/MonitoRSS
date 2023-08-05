import { DynamicModule, Module } from '@nestjs/common';
import { Request, Response } from './entities';
import { FeedFetcherController } from './feed-fetcher.controller';
import { FeedFetcherService } from './feed-fetcher.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MessageBrokerModule } from '../message-broker/message-broker.module';
import { FeedFetcherListenerService } from './feed-fetcher-listener.service';

@Module({
  controllers: [],
  providers: [FeedFetcherService],
  exports: [FeedFetcherService],
  imports: [MikroOrmModule.forFeature([Request, Response])],
})
export class FeedFetcherModule {
  static forService(): DynamicModule {
    return {
      module: FeedFetcherModule,
      imports: [MessageBrokerModule.forRoot()],
      providers: [FeedFetcherListenerService],
    };
  }

  static forApi(): DynamicModule {
    return {
      module: FeedFetcherModule,
      providers: [FeedFetcherController],
      imports: [],
    };
  }

  static forApiAndService(): DynamicModule {
    return {
      module: FeedFetcherModule,
      imports: [MessageBrokerModule.forRoot()],
      providers: [FeedFetcherController, FeedFetcherListenerService],
    };
  }
}
