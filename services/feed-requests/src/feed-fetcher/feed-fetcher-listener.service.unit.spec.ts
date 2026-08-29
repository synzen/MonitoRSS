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
import { MessageBrokerQueue } from '@monitorss/contracts';

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

  describe('bulk recovery attempts', () => {
    const recoveryStartedAt = Date.now() - 60_000;
    const recoveryBatchRequest = {
      timestamp: Date.now(),
      data: [{ url: feedUrl, recovery: { startedAt: recoveryStartedAt } }],
      rateSeconds: 1800,
    };

    const runRecoveryHandler = async (
      batchRequest: unknown = recoveryBatchRequest,
    ) => {
      await (
        service as unknown as {
          onBrokerFetchRequestBatchHandler: (
            batchRequest: unknown,
          ) => Promise<void>;
        }
      ).onBrokerFetchRequestBatchHandler(batchRequest);
    };

    const enableFreshCacheMocks = () => {
      cacheStorageService.setNX.mockResolvedValue(true);
      partitionedRequestsStoreService.getLatestRequestWithOkStatus.mockResolvedValue(
        {
          createdAt: new Date(recoveryStartedAt - 3_600_000),
          requestInitiatedAt: new Date(recoveryStartedAt - 3_600_000),
          responseHeaders: {
            'cache-control': 'public, max-age=3600',
            date: new Date(recoveryStartedAt - 1_800_000).toUTCString(),
          },
        },
      );
    };

    it('performs a fresh request despite old terminal failures and recent-request state', async () => {
      cacheStorageService.setNX.mockResolvedValue(true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mockResolvedValue(
        true,
      );
      partitionedRequestsStoreService.countFailedRequests.mockImplementation(
        (_lookupKey: string, since?: Date) =>
          since && since.getTime() >= recoveryStartedAt ? 0 : 3,
      );
      feedFetcherService.fetchAndSaveResponse.mockResolvedValue({
        request: { status: RequestStatus.OK },
      });

      await runRecoveryHandler();

      expect(
        partitionedRequestsStoreService.wasRequestedInPastSeconds,
      ).not.toHaveBeenCalled();

      const countCall =
        partitionedRequestsStoreService.countFailedRequests.mock.calls[0];
      expect(countCall[1]).toBeInstanceOf(Date);
      expect((countCall[1] as Date).getTime()).toBeGreaterThanOrEqual(
        recoveryStartedAt,
      );

      expect(feedFetcherService.fetchAndSaveResponse).toHaveBeenCalled();
      expect(amqpConnection.publish).toHaveBeenCalledWith(
        '',
        MessageBrokerQueue.UrlFetchCompleted,
        expect.objectContaining({
          data: expect.objectContaining({
            recovery: { startedAt: recoveryStartedAt },
          }),
        }),
      );
    });

    it('fetches fresh instead of trusting a still-fresh cached response', async () => {
      enableFreshCacheMocks();
      partitionedRequestsStoreService.countFailedRequests.mockResolvedValue(0);
      feedFetcherService.fetchAndSaveResponse.mockResolvedValue({
        request: { status: RequestStatus.OK },
      });

      await runRecoveryHandler();

      expect(feedFetcherService.fetchAndSaveResponse).toHaveBeenCalled();
    });

    it('emits the failed url event when the fresh recovery cycle is exhausted', async () => {
      cacheStorageService.setNX.mockResolvedValue(true);
      partitionedRequestsStoreService.countFailedRequests.mockResolvedValue(3);

      await runRecoveryHandler();

      expect(feedFetcherService.fetchAndSaveResponse).not.toHaveBeenCalled();
      expect(amqpConnection.publish).toHaveBeenCalledWith(
        '',
        'url.failed.disable-feeds',
        expect.objectContaining({
          data: expect.objectContaining({
            recovery: { startedAt: recoveryStartedAt },
          }),
        }),
      );
    });

    it('honors fresh backoff recorded during the recovery cycle', async () => {
      cacheStorageService.setNX.mockResolvedValue(true);
      partitionedRequestsStoreService.countFailedRequests.mockResolvedValue(1);
      partitionedRequestsStoreService.getLatestNextRetryDate.mockResolvedValue(
        new Date(Date.now() + 10 * 60_000),
      );

      await runRecoveryHandler();

      expect(feedFetcherService.fetchAndSaveResponse).not.toHaveBeenCalled();
      expect(amqpConnection.publish).not.toHaveBeenCalledWith(
        '',
        'url.fetch.completed',
        expect.anything(),
      );
    });

    it('ignores stale backoff dates from the terminal failure history', async () => {
      cacheStorageService.setNX.mockResolvedValue(true);
      partitionedRequestsStoreService.countFailedRequests.mockResolvedValue(1);
      // A backoff date from the old (terminal) cycle still far in the future.
      partitionedRequestsStoreService.getLatestNextRetryDate.mockImplementation(
        (_lookupKey: string, since?: Date) =>
          since ? null : new Date(Date.now() + 48 * 3_600_000),
      );
      feedFetcherService.fetchAndSaveResponse.mockResolvedValue({
        request: { status: RequestStatus.OK },
      });

      await runRecoveryHandler();

      expect(feedFetcherService.fetchAndSaveResponse).toHaveBeenCalled();
      expect(
        partitionedRequestsStoreService.getLatestNextRetryDate,
      ).toHaveBeenCalledWith(feedUrl, expect.any(Date));
    });

    it('skips the whole batch when it fails contract validation', async () => {
      await runRecoveryHandler({
        timestamp: Date.now(),
        data: [{ url: feedUrl, recovery: { startedAt: 0 } }],
        rateSeconds: 1800,
      });

      expect(cacheStorageService.setNX).not.toHaveBeenCalled();
      expect(feedFetcherService.fetchAndSaveResponse).not.toHaveBeenCalled();
    });
  });
});
