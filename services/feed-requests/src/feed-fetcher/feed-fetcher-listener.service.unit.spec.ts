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
        `listener-service-${feedUrl}`,
      );
    });
  });
});
