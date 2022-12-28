import { DynamicModule, Module } from '@nestjs/common';
import { Request, Response } from './entities';
import { FeedFetcherController } from './feed-fetcher.controller';
import { FeedFetcherService } from './feed-fetcher.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MessageBrokerModule } from '../message-broker/message-broker.module';

@Module({
  controllers: [FeedFetcherController],
  providers: [FeedFetcherService],
  exports: [FeedFetcherService],
  imports: [MikroOrmModule.forFeature([Request, Response])],
})
export class FeedFetcherModule {
  static forRoot(): DynamicModule {
    return {
      module: FeedFetcherModule,
      imports: [MessageBrokerModule.forRoot()],
    };
  }
}
