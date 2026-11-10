import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { createFeedFetcherListener } from './feed-fetcher-listener';
import type { BackoffConfig } from '../feed-fetcher/scheduled-fetch';
import { RequestStatus } from '../feed-fetcher/types';
import { MessageBrokerQueue } from '@monitorss/contracts';
import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

const backoffConfig: BackoffConfig = {
  suspensionBaseMs: 4 * 60 * 60 * 1000,
  suspensionRateMultiplier: 2,
  tier1BoundaryMs: 24 * 60 * 60 * 1000,
  tier2BoundaryMs: 72 * 60 * 60 * 1000,
  expiryMs: 14 * 24 * 60 * 60 * 1000,
  rateLimitFloorMs: 60 * 60 * 1000,
  retryAfterClampMs: 24 * 60 * 60 * 1000,
};

const createFeedFetcherServiceMock = () => ({
  fetchAndSaveResponse: mock.fn<any>(),
});

const createPartitionedRequestsStoreServiceMock = () => ({
  flushInserts: mock.fn<any>(),
  wasRequestedInPastSeconds: mock.fn<any>(),
  getLatestRequestWithOkStatus: mock.fn<any>(),
  getLatestAttempt: mock.fn<any>(),
  getEarliestRequestCreatedAt: mock.fn<any>(),
});

const createHostRateLimiterServiceMock = () => ({
  incrementUrlCount: mock.fn<any>(),
});

const createCacheStorageServiceMock = () => ({
  setNX: mock.fn<any>(),
  del: mock.fn<any>(),
});

const createPublishMock = () => mock.fn<any>();

describe('FeedFetcherListener', () => {
  let listener: ReturnType<typeof createFeedFetcherListener>;
  let feedFetcherService: ReturnType<typeof createFeedFetcherServiceMock>;
  let partitionedRequestsStoreService: ReturnType<
    typeof createPartitionedRequestsStoreServiceMock
  >;
  let hostRateLimiterService: ReturnType<
    typeof createHostRateLimiterServiceMock
  >;
  let cacheStorageService: ReturnType<typeof createCacheStorageServiceMock>;
  let publish: ReturnType<typeof createPublishMock>;
  const feedUrl = 'https://rss-feed.com/feed.xml';

  const publishCallsFor = (queue: string) =>
    publish.mock.calls.filter((call) => call.arguments[0] === queue);

  const runHandler = async (batchRequest: unknown): Promise<void> => {
    await listener.onBrokerFetchRequestBatchHandler(
      batchRequest as Parameters<
        typeof listener.onBrokerFetchRequestBatchHandler
      >[0],
    );
  };

  beforeEach(() => {
    feedFetcherService = createFeedFetcherServiceMock();
    partitionedRequestsStoreService =
      createPartitionedRequestsStoreServiceMock();
    partitionedRequestsStoreService.flushInserts.mock.mockImplementation(
      async () => undefined,
    );
    partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.mockImplementation(
      async () => false,
    );
    partitionedRequestsStoreService.getLatestRequestWithOkStatus.mock.mockImplementation(
      async () => null,
    );
    partitionedRequestsStoreService.getLatestAttempt.mock.mockImplementation(
      async () => null,
    );
    partitionedRequestsStoreService.getEarliestRequestCreatedAt.mock.mockImplementation(
      async () => null,
    );
    hostRateLimiterService = createHostRateLimiterServiceMock();
    hostRateLimiterService.incrementUrlCount.mock.mockImplementation(
      async () => ({ isRateLimited: false }),
    );
    cacheStorageService = createCacheStorageServiceMock();
    publish = createPublishMock();

    listener = createFeedFetcherListener({
      backoffConfig,
      feedFetcher: feedFetcherService as never,
      partitionedRequestsStore: partitionedRequestsStoreService as never,
      hostRateLimiter: hostRateLimiterService as never,
      cacheStorage: cacheStorageService as never,
      publish: publish as never,
    });
  });

  it('is defined', () => {
    assert.ok(listener);
  });

  describe('emitFailedUrl', () => {
    it('publishes the url event', () => {
      listener.emitFailedUrl({ url: feedUrl });

      assert.strictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFailedDisableFeeds).length,
        1,
      );
    });
  });

  describe('onBrokerFetchRequestBatchHandler', () => {
    const batchRequest = {
      timestamp: Date.now(),
      data: [{ url: feedUrl }],
      rateSeconds: 1800,
    };

    const runBatch = async (): Promise<void> => runHandler(batchRequest);

    it('does not delete the processing lock if this worker did not acquire it', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => false);

      await runBatch();

      assert.strictEqual(
        partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.callCount(),
        0,
      );
      assert.strictEqual(cacheStorageService.del.mock.callCount(), 0);
    });

    it('deletes the processing lock when a request was recently processed', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.mockImplementation(
        async () => true,
      );

      await runBatch();

      assert.deepStrictEqual(cacheStorageService.del.mock.calls[0].arguments, [
        `listener-service-${feedUrl}-${batchRequest.rateSeconds}`,
      ]);
    });

    it('emits url.fetch.completed without fetching when the cache is still fresh', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.mockImplementation(
        async () => false,
      );
      partitionedRequestsStoreService.getLatestRequestWithOkStatus.mock.mockImplementation(
        async () => ({
          createdAt: new Date(),
          requestInitiatedAt: new Date(),
          responseHeaders: {
            'cache-control': 'public, max-age=3600',
            date: new Date().toUTCString(),
          },
        }),
      );

      await runBatch();

      assert.strictEqual(
        feedFetcherService.fetchAndSaveResponse.mock.callCount(),
        0,
      );
      assert.deepStrictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFetchCompleted)[0].arguments,
        [
          MessageBrokerQueue.UrlFetchCompleted,
          {
            data: {
              lookupKey: undefined,
              url: feedUrl,
              rateSeconds: batchRequest.rateSeconds,
              debug: undefined,
              recovery: undefined,
              trigger: undefined,
            },
          },
        ],
      );
    });

    it('emits url.fetch.completed when the fetch succeeds', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.mockImplementation(
        async () => false,
      );
      feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: { status: RequestStatus.OK },
        }),
      );

      await runBatch();

      assert.deepStrictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFetchCompleted)[0].arguments,
        [
          MessageBrokerQueue.UrlFetchCompleted,
          {
            data: {
              lookupKey: undefined,
              url: feedUrl,
              rateSeconds: batchRequest.rateSeconds,
              debug: undefined,
              recovery: undefined,
              trigger: undefined,
            },
          },
        ],
      );
    });

    it('does not emit url.fetch.completed when the fetch fails', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.mockImplementation(
        async () => false,
      );
      feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: { status: RequestStatus.FETCH_ERROR },
        }),
      );

      await runBatch();

      assert.strictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFetchCompleted).length,
        0,
      );
    });
  });

  describe('scheduled trigger copy-through', () => {
    const occurredAt = Date.parse('2026-09-26T13:00:00Z');
    const scheduledBatchRequest = {
      timestamp: Date.now(),
      data: [
        {
          url: feedUrl,
          trigger: { kind: 'scheduled', occurredAt },
        },
      ],
      rateSeconds: 3600,
    };

    const runScheduledHandler = async (
      batchRequest: unknown = scheduledBatchRequest,
    ): Promise<void> => runHandler(batchRequest);

    const enableSuccessfulFetch = () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.mockImplementation(
        async () => false,
      );
      feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: { status: RequestStatus.OK },
        }),
      );
    };

    it('scopes the processing lock by the occurrence time', async () => {
      enableSuccessfulFetch();

      await runScheduledHandler();

      assert.deepStrictEqual(
        cacheStorageService.setNX.mock.calls[0].arguments,
        [
          {
            key: `listener-service-${feedUrl}-3600-${occurredAt}`,
            body: '1',
            expSeconds: 120,
          },
        ],
      );
      assert.deepStrictEqual(cacheStorageService.del.mock.calls[0].arguments, [
        `listener-service-${feedUrl}-3600-${occurredAt}`,
      ]);
    });

    it('copies the trigger onto the completed event after a successful fetch', async () => {
      enableSuccessfulFetch();

      await runScheduledHandler();

      // Scheduled entries scope response reuse to the short occurrence window,
      // not the interval-derived rateSeconds / 2.
      assert.deepStrictEqual(
        partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.calls[0]
          .arguments,
        [feedUrl, 120],
      );
      assert.deepStrictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFetchCompleted)[0].arguments,
        [
          MessageBrokerQueue.UrlFetchCompleted,
          {
            data: {
              lookupKey: undefined,
              url: feedUrl,
              rateSeconds: 3600,
              debug: undefined,
              recovery: undefined,
              trigger: { kind: 'scheduled', occurredAt },
            },
          },
        ],
      );
    });

    it('copies the trigger onto the completed event when reusing a recent response', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.mockImplementation(
        async () => true,
      );

      await runScheduledHandler();

      assert.strictEqual(
        feedFetcherService.fetchAndSaveResponse.mock.callCount(),
        0,
      );
      assert.deepStrictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFetchCompleted)[0].arguments,
        [
          MessageBrokerQueue.UrlFetchCompleted,
          {
            data: {
              lookupKey: undefined,
              url: feedUrl,
              rateSeconds: 3600,
              debug: undefined,
              recovery: undefined,
              trigger: { kind: 'scheduled', occurredAt },
            },
          },
        ],
      );
    });

    it('keeps trigger-less interval entries on the unscoped lock key', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.mockImplementation(
        async () => true,
      );

      const intervalBatchRequest = {
        timestamp: Date.now(),
        data: [{ url: feedUrl }],
        rateSeconds: 1800,
      };

      await runHandler(intervalBatchRequest);

      assert.deepStrictEqual(
        cacheStorageService.setNX.mock.calls[0].arguments,
        [
          {
            key: `listener-service-${feedUrl}-${intervalBatchRequest.rateSeconds}`,
            body: '1',
            expSeconds: 120,
          },
        ],
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
    ): Promise<void> => runHandler(batchRequest);

    const enableFreshCacheMocks = () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.getLatestRequestWithOkStatus.mock.mockImplementation(
        async () => ({
          createdAt: new Date(recoveryStartedAt - 3_600_000),
          requestInitiatedAt: new Date(recoveryStartedAt - 3_600_000),
          responseHeaders: {
            'cache-control': 'public, max-age=3600',
            date: new Date(recoveryStartedAt - 1_800_000).toUTCString(),
          },
        }),
      );
    };

    it('performs a fresh request despite recent-request state', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.mockImplementation(
        async () => true,
      );
      feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: { status: RequestStatus.OK },
        }),
      );

      await runRecoveryHandler();

      assert.strictEqual(
        partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.callCount(),
        0,
      );

      assert.ok(feedFetcherService.fetchAndSaveResponse.mock.callCount() > 0);

      assert.partialDeepStrictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFetchCompleted)[0].arguments[1],
        {
          data: {
            recovery: { startedAt: recoveryStartedAt },
          },
        },
      );
    });

    it('fetches fresh instead of trusting a still-fresh cached response', async () => {
      enableFreshCacheMocks();
      feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: { status: RequestStatus.OK },
        }),
      );

      await runRecoveryHandler();

      assert.ok(feedFetcherService.fetchAndSaveResponse.mock.callCount() > 0);
    });

    it('emits the failed url event when the backoff has expired', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.getLatestRequestWithOkStatus.mock.mockImplementation(
        async () => ({
          createdAt: new Date(Date.now() - 15 * 24 * 3_600_000),
          requestInitiatedAt: new Date(Date.now() - 15 * 24 * 3_600_000),
        }),
      );

      await runRecoveryHandler();

      assert.strictEqual(
        feedFetcherService.fetchAndSaveResponse.mock.callCount(),
        0,
      );
      assert.strictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFailedDisableFeeds).length,
        1,
      );
    });

    it('bypasses the backoff for forced bulk-retry fetches', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.mockImplementation(
        async () => true,
      );
      partitionedRequestsStoreService.getLatestRequestWithOkStatus.mock.mockImplementation(
        async () => ({
          createdAt: new Date(Date.now() - 15 * 24 * 3_600_000),
          requestInitiatedAt: new Date(Date.now() - 15 * 24 * 3_600_000),
        }),
      );
      feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: { status: RequestStatus.OK },
        }),
      );

      await runHandler({
        timestamp: Date.now(),
        data: [{ url: feedUrl, force: true }],
        rateSeconds: 1800,
      });

      assert.ok(feedFetcherService.fetchAndSaveResponse.mock.callCount() > 0);
      assert.strictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFailedDisableFeeds).length,
        0,
      );
    });

    it('skips the whole batch when it fails contract validation', async () => {
      await runRecoveryHandler({
        timestamp: Date.now(),
        data: [{ url: feedUrl, recovery: { startedAt: 0 } }],
        rateSeconds: 1800,
      });

      assert.strictEqual(cacheStorageService.setNX.mock.callCount(), 0);
      assert.strictEqual(
        feedFetcherService.fetchAndSaveResponse.mock.callCount(),
        0,
      );
    });
  });
});
