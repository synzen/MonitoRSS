import { ConfigService } from '@nestjs/config';
import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { FeedFetcherListenerService } from './feed-fetcher-listener.service';
import { RequestStatus } from './constants';
import { MessageBrokerQueue } from '@monitorss/contracts';
import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

const createFeedFetcherServiceMock = () => ({
  fetchAndSaveResponse: mock.fn<any>(),
});

const createPartitionedRequestsStoreServiceMock = () => ({
  flushInserts: mock.fn<any>(),
  wasRequestedInPastSeconds: mock.fn<any>(),
  getLatestRequestWithOkStatus: mock.fn<any>(),
  countFailedRequests: mock.fn<any>(),
  getLatestNextRetryDate: mock.fn<any>(),
});

const createHostRateLimiterServiceMock = () => ({
  incrementUrlCount: mock.fn<any>(),
});

const createCacheStorageServiceMock = () => ({
  setNX: mock.fn<any>(),
  del: mock.fn<any>(),
});

const createAmqpConnectionMock = () => ({
  publish: mock.fn<any>(),
});

describe('FeedFetcherListenerService', () => {
  let service: FeedFetcherListenerService;
  let configService: ConfigService;
  let mockMikroOrm: MikroORM;
  let feedFetcherService: ReturnType<typeof createFeedFetcherServiceMock>;
  let em: { flush: ReturnType<typeof mock.fn<any>> };
  let partitionedRequestsStoreService: ReturnType<
    typeof createPartitionedRequestsStoreServiceMock
  >;
  let hostRateLimiterService: ReturnType<
    typeof createHostRateLimiterServiceMock
  >;
  let cacheStorageService: ReturnType<typeof createCacheStorageServiceMock>;
  let amqpConnection: ReturnType<typeof createAmqpConnectionMock>;
  const feedUrl = 'https://rss-feed.com/feed.xml';
  const defaultUserAgent = 'default-user-agent';

  const publishCallsFor = (queue: string) =>
    amqpConnection.publish.mock.calls.filter(
      (call) => call.arguments[1] === queue,
    );

  const runHandler = async (batchRequest: unknown): Promise<void> => {
    await (
      service as unknown as {
        onBrokerFetchRequestBatchHandler: (
          batchRequest: unknown,
        ) => Promise<void>;
      }
    ).onBrokerFetchRequestBatchHandler(batchRequest);
  };

  beforeEach(async () => {
    configService = {
      get: mock.fn<any>(() => 3),
      getOrThrow: mock.fn<any>(() => defaultUserAgent),
    } as never;
    feedFetcherService = createFeedFetcherServiceMock();
    em = {
      flush: mock.fn<any>(),
    };
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
    partitionedRequestsStoreService.countFailedRequests.mock.mockImplementation(
      async () => 0,
    );
    partitionedRequestsStoreService.getLatestNextRetryDate.mock.mockImplementation(
      async () => null,
    );
    hostRateLimiterService = createHostRateLimiterServiceMock();
    hostRateLimiterService.incrementUrlCount.mock.mockImplementation(
      async () => ({ isRateLimited: false }),
    );
    cacheStorageService = createCacheStorageServiceMock();
    amqpConnection = createAmqpConnectionMock();
    mockMikroOrm = await MikroORM.init({
      // Get past errors related to @EnsureRequestContext() decorator from MikroORM
      driver: PostgreSqlDriver,
      dbName: 'test',
      entities: [],
      discovery: {
        warnWhenNoEntities: false,
      },
    });

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

  it('should be defined', () => {
    assert.ok(service);
  });

  describe('emitFailedUrl', () => {
    it('publishes the url event', () => {
      service.emitFailedUrl({ url: feedUrl });

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
          '',
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
          '',
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
          '',
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
          '',
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

    // eslint-disable-next-line max-len
    it('performs a fresh request despite old terminal failures and recent-request state', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.wasRequestedInPastSeconds.mock.mockImplementation(
        async () => true,
      );
      partitionedRequestsStoreService.countFailedRequests.mock.mockImplementation(
        (_lookupKey: string, since?: Date) =>
          since && since.getTime() >= recoveryStartedAt ? 0 : 3,
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

      const countCall =
        partitionedRequestsStoreService.countFailedRequests.mock.calls[0];
      assert.ok(countCall.arguments[1] instanceof Date);
      assert.ok(
        (countCall.arguments[1] as Date).getTime() >= recoveryStartedAt,
      );

      assert.ok(feedFetcherService.fetchAndSaveResponse.mock.callCount() > 0);

      assert.partialDeepStrictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFetchCompleted)[0].arguments[2],
        {
          data: {
            recovery: { startedAt: recoveryStartedAt },
          },
        },
      );
    });

    it('fetches fresh instead of trusting a still-fresh cached response', async () => {
      enableFreshCacheMocks();
      partitionedRequestsStoreService.countFailedRequests.mock.mockImplementation(
        async () => 0,
      );
      feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: { status: RequestStatus.OK },
        }),
      );

      await runRecoveryHandler();

      assert.ok(feedFetcherService.fetchAndSaveResponse.mock.callCount() > 0);
    });

    it('emits the failed url event when the fresh recovery cycle is exhausted', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.countFailedRequests.mock.mockImplementation(
        async () => 3,
      );

      await runRecoveryHandler();

      assert.strictEqual(
        feedFetcherService.fetchAndSaveResponse.mock.callCount(),
        0,
      );
      assert.partialDeepStrictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFailedDisableFeeds)[0]
          .arguments[2],
        {
          data: {
            recovery: { startedAt: recoveryStartedAt },
          },
        },
      );
    });

    it('honors fresh backoff recorded during the recovery cycle', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.countFailedRequests.mock.mockImplementation(
        async () => 1,
      );
      partitionedRequestsStoreService.getLatestNextRetryDate.mock.mockImplementation(
        async () => new Date(Date.now() + 10 * 60_000),
      );

      await runRecoveryHandler();

      assert.strictEqual(
        feedFetcherService.fetchAndSaveResponse.mock.callCount(),
        0,
      );
      assert.strictEqual(
        publishCallsFor(MessageBrokerQueue.UrlFetchCompleted).length,
        0,
      );
    });

    it('ignores stale backoff dates from the terminal failure history', async () => {
      cacheStorageService.setNX.mock.mockImplementation(async () => true);
      partitionedRequestsStoreService.countFailedRequests.mock.mockImplementation(
        async () => 1,
      );
      // A backoff date from the old (terminal) cycle still far in the future.
      partitionedRequestsStoreService.getLatestNextRetryDate.mock.mockImplementation(
        (_lookupKey: string, since?: Date) =>
          since ? null : new Date(Date.now() + 48 * 3_600_000),
      );
      feedFetcherService.fetchAndSaveResponse.mock.mockImplementation(
        async () => ({
          request: { status: RequestStatus.OK },
        }),
      );

      await runRecoveryHandler();

      assert.ok(feedFetcherService.fetchAndSaveResponse.mock.callCount() > 0);
      assert.ok(
        partitionedRequestsStoreService.getLatestNextRetryDate.mock.calls[0]
          .arguments[1] instanceof Date,
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
