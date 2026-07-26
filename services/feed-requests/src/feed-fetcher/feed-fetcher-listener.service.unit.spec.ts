import { ConfigService } from '@nestjs/config';
import { MikroORM } from '@mikro-orm/core';
// Polyfill for Jest VM environment (redis v4 depends on undici which needs these)
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';

Object.assign(globalThis, {
  ReadableStream,
  WritableStream,
  TransformStream,
});

import { FeedFetcherListenerService } from './feed-fetcher-listener.service';
import { RequestStatus } from './constants';

jest.mock('../utils/logger');

describe('FeedFetcherListenerService', () => {
  let service: FeedFetcherListenerService;
  let configService: ConfigService;
  let mockMikroOrm: MikroORM;
  let feedFetcherService: { fetchAndSaveResponse: jest.Mock };
  let em: { flush: jest.Mock };
  let partitionedRequestsStoreService: {
    flushInserts: jest.Mock;
    wasRequestedInPastSeconds: jest.Mock;
    getLatestRequestWithOkStatus: jest.Mock;
    countFailedRequests: jest.Mock;
    getLatestNextRetryDate: jest.Mock;
  };
  let hostRateLimiterService: { incrementUrlCount: jest.Mock };
  let cacheStorageService: { setNX: jest.Mock; del: jest.Mock };
  const feedUrl = 'https://rss-feed.com/feed.xml';
  const defaultUserAgent = 'default-user-agent';
  const amqpConnection = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockReturnValue(3),
      getOrThrow: jest.fn().mockReturnValue(defaultUserAgent),
    } as never;
    feedFetcherService = {
      fetchAndSaveResponse: jest.fn(),
    };
    em = {
      flush: jest.fn().mockResolvedValue(undefined),
    };
    partitionedRequestsStoreService = {
      flushInserts: jest.fn().mockResolvedValue(undefined),
      wasRequestedInPastSeconds: jest.fn(),
      getLatestRequestWithOkStatus: jest.fn().mockResolvedValue(null),
      countFailedRequests: jest.fn().mockResolvedValue(0),
      getLatestNextRetryDate: jest.fn().mockResolvedValue(null),
    };
    hostRateLimiterService = {
      incrementUrlCount: jest.fn().mockResolvedValue({ isRateLimited: false }),
    };
    cacheStorageService = {
      setNX: jest.fn(),
      del: jest.fn().mockResolvedValue(undefined),
    };
    mockMikroOrm = await MikroORM.init(
      {
        // Get past errors related to @UseRequestContext() decorator from MikroORM
        type: 'postgresql',
        dbName: 'test',
        entities: [],
        discovery: {
          warnWhenNoEntities: false,
        },
      },
      false,
    );

    service = new FeedFetcherListenerService(
      configService,
      feedFetcherService as never,
      amqpConnection as never,
      mockMikroOrm,
      em as never,
      partitionedRequestsStoreService as never,
      hostRateLimiterService as never,
      cacheStorageService as never,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emitFailedUrl', () => {
    it('publishes the url event', () => {
      service.emitFailedUrl({ url: feedUrl });

      expect(amqpConnection.publish).toHaveBeenCalled();
    });
  });

  describe('onBrokerFetchRequestBatchHandler', () => {
    const batchRequest = {
      timestamp: Date.now(),
      data: [{ url: feedUrl }],
      rateSeconds: 1800,
    };

    const runHandler = async () => {
      await (
        service as unknown as {
          onBrokerFetchRequestBatchHandler: (
            batchRequest: unknown,
          ) => Promise<void>;
        }
      ).onBrokerFetchRequestBatchHandler(batchRequest);
    };

    it('does not delete the processing lock if this worker did not acquire it', async () => {
      cacheStorageService.setNX.mockResolvedValue(false);

      await runHandler();

      expect(
        partitionedRequestsStoreService.wasRequestedInPastSeconds,
      ).not.toHaveBeenCalled();
      expect(cacheStorageService.del).not.toHaveBeenCalled();
    });

    it('deletes the processing lock when a request was recently processed', async () => {
      cacheStorageService.setNX.mockResolvedValue(true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mockResolvedValue(
        true,
      );

      await runHandler();

      expect(cacheStorageService.del).toHaveBeenCalledWith(
        `listener-service-${feedUrl}-${batchRequest.rateSeconds}`,
      );
    });

    it('emits url.fetch.completed without fetching when the cache is still fresh', async () => {
      cacheStorageService.setNX.mockResolvedValue(true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mockResolvedValue(
        false,
      );
      partitionedRequestsStoreService.getLatestRequestWithOkStatus.mockResolvedValue(
        {
          createdAt: new Date(),
          requestInitiatedAt: new Date(),
          responseHeaders: {
            'cache-control': 'public, max-age=3600',
            date: new Date().toUTCString(),
          },
        },
      );

      await runHandler();

      expect(feedFetcherService.fetchAndSaveResponse).not.toHaveBeenCalled();
      expect(amqpConnection.publish).toHaveBeenCalledWith(
        '',
        'url.fetch.completed',
        {
          data: {
            lookupKey: undefined,
            url: feedUrl,
            rateSeconds: batchRequest.rateSeconds,
            debug: undefined,
          },
        },
      );
    });

    it('emits url.fetch.completed when the fetch succeeds', async () => {
      cacheStorageService.setNX.mockResolvedValue(true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mockResolvedValue(
        false,
      );
      feedFetcherService.fetchAndSaveResponse.mockResolvedValue({
        request: { status: RequestStatus.OK },
      });

      await runHandler();

      expect(amqpConnection.publish).toHaveBeenCalledWith(
        '',
        'url.fetch.completed',
        {
          data: {
            lookupKey: undefined,
            url: feedUrl,
            rateSeconds: batchRequest.rateSeconds,
            debug: undefined,
          },
        },
      );
    });

    it('does not emit url.fetch.completed when the fetch fails', async () => {
      cacheStorageService.setNX.mockResolvedValue(true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mockResolvedValue(
        false,
      );
      feedFetcherService.fetchAndSaveResponse.mockResolvedValue({
        request: { status: RequestStatus.FETCH_ERROR },
      });

      await runHandler();

      expect(amqpConnection.publish).not.toHaveBeenCalledWith(
        '',
        'url.fetch.completed',
        expect.anything(),
      );
    });
  });
});
