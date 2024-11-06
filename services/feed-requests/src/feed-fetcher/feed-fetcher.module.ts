/* eslint-disable max-len */
import { DynamicModule, Module } from '@nestjs/common';
import { Request, Response } from './entities';
import { FeedFetcherController } from './feed-fetcher.controller';
import { FeedFetcherService } from './feed-fetcher.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MessageBrokerModule } from '../message-broker/message-broker.module';
import { FeedFetcherListenerService } from './feed-fetcher-listener.service';
import { ObjectFileStorageModule } from '../object-file-storage/object-file-storage.module';
import { CacheStorageModule } from '../cache-storage/cache-storage.module';
import { PartitionedRequestsStoreModule } from '../partitioned-requests-store/partitioned-requests-store.module';
import { FeatureFlaggerModule } from '../feature-flagger/feature-flagger.module';

@Module({
  controllers: [],
  providers: [FeedFetcherService],
  exports: [FeedFetcherService],
  imports: [
    ObjectFileStorageModule,
    CacheStorageModule,
    MikroOrmModule.forFeature([Request, Response]),
    PartitionedRequestsStoreModule,
    FeatureFlaggerModule.forRoot(),
  ],
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
      controllers: [FeedFetcherController],
      imports: [],
    };
  }

  static forApiAndService(): DynamicModule {
    return {
      module: FeedFetcherModule,
      controllers: [FeedFetcherController],
      imports: [MessageBrokerModule.forRoot()],
      providers: [FeedFetcherListenerService],
    };
  }
}
