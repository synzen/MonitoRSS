import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

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
  private apiService: FeedFetcherApiProtoInterface;

  constructor(
    @Inject('FEED_FETCHER_API') private readonly client: ClientGrpc,
  ) {}

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
