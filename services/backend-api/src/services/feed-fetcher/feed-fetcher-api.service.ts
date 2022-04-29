import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client, ClientGrpc, Transport } from '@nestjs/microservices';
import { join } from 'path';

interface FetchFeedApiOptions {
  url: string;
  executeFetch?: boolean;
}

interface FeedFetchOptions {
  getCachedResponse?: boolean;
}

interface FetchFeedResponseSuccess {
  requestStatus: 'success';
  response: {
    body: string;
    statusCode: number;
  };
}

interface FetchFeedResponsePending {
  requestStatus: 'pending';
}

interface FetchFeedResponseError {
  requestStatus: 'error';
}

interface FeedFetchResponseParseError {
  requestStatus: 'parse_error';
  response: {
    statusCode: number;
  };
}

interface FeedFetcherApiProtoInterface {
  fetchFeed(
    options: FetchFeedApiOptions,
  ): Promise<
    | FetchFeedResponseSuccess
    | FetchFeedResponseError
    | FetchFeedResponsePending
    | FeedFetchResponseParseError
  >;
}

@Injectable()
export class FeedFetcherApiService implements OnModuleInit {
  @Client({
    transport: Transport.GRPC,
    options: {
      package: 'feedfetcher',
      protoPath: join(__dirname, 'feed-fetcher-api.proto'),
    },
  })
  private client: ClientGrpc;
  private apiService: FeedFetcherApiProtoInterface;

  onModuleInit() {
    this.apiService = this.client.getService<FeedFetcherApiProtoInterface>(
      'FeedFetcherController',
    );
  }

  async fetchAndSave(url: string, options?: FeedFetchOptions) {
    return this.apiService.fetchFeed({
      url,
      executeFetch: options?.getCachedResponse ? false : true,
    });
  }
}
