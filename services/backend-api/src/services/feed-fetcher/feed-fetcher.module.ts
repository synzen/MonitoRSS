import { Module } from '@nestjs/common';
import { FeedFetcherService } from './feed-fetcher.service';
import { FeedFetcherApiService } from './feed-fetcher-api.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

@Module({
  providers: [FeedFetcherService, FeedFetcherApiService],
  exports: [FeedFetcherService],
  imports: [
    ClientsModule.register([
      {
        name: 'FEED_FETCHER_API',
        transport: Transport.GRPC,
        options: {
          package: 'feedfetcher',
          protoPath: join(__dirname, 'feed-fetcher-api.proto'),
        },
      },
    ]),
  ],
})
export class FeedFetcherModule {}
