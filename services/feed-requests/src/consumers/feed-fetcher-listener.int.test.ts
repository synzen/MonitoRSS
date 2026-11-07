/* eslint-disable max-len */
import { randomUUID } from 'crypto';
import dayjs from 'dayjs';
import {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
  mock,
} from 'node:test';
import assert from 'node:assert';
import { RequestStatus, RequestSource } from '../feed-fetcher/types';
import { createFeedFetcherListener } from './feed-fetcher-listener';
import {
  createScheduledFetchPolicies,
  type BackoffConfig,
} from '../feed-fetcher/scheduled-fetch';
import { createPartitionedRequestsStore } from '../stores/postgres/partitioned-requests-store';
import type { PartitionedRequestInsert } from '../feed-fetcher/types';
import { createHostRateLimiterService } from '../host-rate-limiter/host-rate-limiter';
import {
  truncatePartitionedTables,
  setupPostgresTests,
  teardownPostgresTests,
  getTestPool,
} from '../stores/postgres/setup-postgres-tests';
import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

describe('FeedFetcherListener (Integration)', () => {
  let listener: ReturnType<typeof createFeedFetcherListener>;
  let policies: ReturnType<typeof createScheduledFetchPolicies>;
  const feedUrl = 'https://rss-feed.com/feed.xml';

  const backoffConfig: BackoffConfig = {
    suspensionBaseMs: 4 * 60 * 60 * 1000,
    suspensionRateMultiplier: 2,
    tier1BoundaryMs: 24 * 60 * 60 * 1000,
    tier2BoundaryMs: 72 * 60 * 60 * 1000,
    expiryMs: 14 * 24 * 60 * 60 * 1000,
    rateLimitFloorMs: 60 * 60 * 1000,
    retryAfterClampMs: 24 * 60 * 60 * 1000,
  };

  // nock cannot intercept undici.request, so the HTTP layer is stubbed at the
  // FeedFetcherService seam; everything around it (locks, dedupe, backoff
  // derivation, flush, event emission) runs for real.
  const fetchAndSaveResponse = mock.fn<any>();
  const publish = mock.fn<any>();
  const cacheStorageService = {
    setNX: mock.fn<any>(),
    del: mock.fn<any>(),
    increment: mock.fn<any>(),
  };

  before(async () => {
    await setupPostgresTests();

    listener = createFeedFetcherListener({
      backoffConfig,
      feedFetcher: { fetchAndSaveResponse } as never,
      partitionedRequestsStore: createPartitionedRequestsStore(getTestPool()),
      hostRateLimiter: createHostRateLimiterService(
        cacheStorageService as never,
      ) as never,
      cacheStorage: cacheStorageService as never,
      publish: publish as never,
    });
    policies = createScheduledFetchPolicies({
      backoffConfig,
      partitionedRequestsStore: createPartitionedRequestsStore(getTestPool()),
    });
  });

  beforeEach(async () => {
    cacheStorageService.setNX.mock.mockImplementation(async () => true);
    cacheStorageService.del.mock.mockImplementation(async () => undefined);
    cacheStorageService.increment.mock.mockImplementation(async () => 1);
  });

  afterEach(async () => {
    fetchAndSaveResponse.mock.resetCalls();
    publish.mock.resetCalls();
    cacheStorageService.setNX.mock.resetCalls();
    cacheStorageService.del.mock.resetCalls();
    cacheStorageService.increment.mock.resetCalls();

    await truncatePartitionedTables();
  });

  after(async () => {
    await teardownPostgresTests();
  });

  const buildInsert = (
    overrides: Partial<PartitionedRequestInsert> = {},
  ): PartitionedRequestInsert => ({
    id: randomUUID(),
    status: RequestStatus.FETCH_ERROR,
    source: RequestSource.Schedule,
    fetchOptions: null,
    url: feedUrl,
    // Production defaults the lookup key to the URL (feed-fetcher.service.ts).
    lookupKey: feedUrl,
    createdAt: new Date(),
    nextRetryDate: null,
    errorMessage: null,
    requestInitiatedAt: new Date(),
    response: null,
    ...overrides,
  });

  const seedRequests = async (
    inserts: PartitionedRequestInsert[],
  ): Promise<void> => {
    await createPartitionedRequestsStore(getTestPool()).flushInserts(inserts);
  };

  const getAllRows = async (): Promise<
    Array<{
      id: string;
      status: string;
      created_at: Date;
      next_retry_date: Date | null;
    }>
  > => {
    return (
      await getTestPool().query(
        `SELECT id, status, created_at, next_retry_date FROM request_partitioned ORDER BY created_at ASC, id ASC`,
      )
    ).rows;
  };

  const publishedEvents = (queue: string) =>
    publish.mock.calls.filter((call) => call.arguments[0] === queue);

  const runBatch = async (
    data: unknown[],
    rateSeconds = 1800,
  ): Promise<void> => {
    await listener.onBrokerFetchRequestBatch({
      timestamp: Date.now(),
      rateSeconds,
      data,
    } as unknown as Parameters<typeof listener.onBrokerFetchRequestBatch>[0]);
  };

  // A listener whose backoff gives up after 30 minutes, for expiry tests.
  const createShortBackoffListener = () =>
    createFeedFetcherListener({
      backoffConfig: { ...backoffConfig, expiryMs: 30 * 60 * 1000 },
      feedFetcher: { fetchAndSaveResponse } as never,
      partitionedRequestsStore: createPartitionedRequestsStore(getTestPool()),
      hostRateLimiter: createHostRateLimiterService(
        cacheStorageService as never,
      ) as never,
      cacheStorage: cacheStorageService as never,
      publish: publish as never,
    });

  describe('onBrokerFetchRequestBatch', () => {
    it('saves a failed attempt with a next retry date if failed', async () => {
      fetchAndSaveResponse.mock.mockImplementation(async () => ({
        request: buildInsert(),
      }));

      await runBatch([{ url: feedUrl }], 100);

      const rows = await getAllRows();

      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].status, RequestStatus.FETCH_ERROR);
      assert.ok(rows[0].next_retry_date);
    });

    it('does not process the event once the backoff expires', async () => {
      // A listener whose backoff gives up after 30 minutes; the seeded failure
      // is an hour old, so the URL is expired.
      const shortBackoffListener = createShortBackoffListener();

      await seedRequests([
        buildInsert({ createdAt: dayjs().subtract(1, 'hour').toDate() }),
      ]);

      await shortBackoffListener.onBrokerFetchRequestBatchHandler({
        timestamp: Date.now(),
        rateSeconds: 1800,
        data: [{ url: feedUrl }],
      } as unknown as Parameters<
        typeof listener.onBrokerFetchRequestBatchHandler
      >[0]);

      assert.strictEqual(fetchAndSaveResponse.mock.callCount(), 0);
    });

    it('emits a failed url once the backoff expires', async () => {
      const shortBackoffListener = createShortBackoffListener();

      await seedRequests([
        buildInsert({ createdAt: dayjs().subtract(1, 'hour').toDate() }),
      ]);

      await shortBackoffListener.onBrokerFetchRequestBatchHandler({
        timestamp: Date.now(),
        rateSeconds: 1800,
        data: [{ url: feedUrl }],
      } as unknown as Parameters<
        typeof listener.onBrokerFetchRequestBatchHandler
      >[0]);

      assert.strictEqual(publish.mock.callCount(), 1);
      assert.partialDeepStrictEqual(publish.mock.calls[0].arguments, [
        'url.failed.disable-feeds',
        { data: { url: feedUrl } },
      ]);
    });

    // Regression: a scheduled fetch for a URL with prior OK history must not
    // throw when reading the cached response's timestamps back from raw SQL
    // (the previous ORM returned timestamptz as strings). A throw here
    // silently skipped every scheduled fetch in production.
    it('fetches normally when a previous OK request exists with freshness headers', async () => {
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(10, 'minutes').toDate(),
          requestInitiatedAt: dayjs().subtract(10, 'minutes').toDate(),
          response: {
            statusCode: 200,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {
              'cache-control': 'public, max-age=60',
              date: dayjs().subtract(10, 'minutes').toDate().toUTCString(),
            },
            body: null,
          },
        }),
      ]);
      fetchAndSaveResponse.mock.mockImplementation(async () => ({
        request: buildInsert({ status: RequestStatus.OK }),
      }));

      await runBatch([{ url: feedUrl }], 100);

      assert.strictEqual(fetchAndSaveResponse.mock.callCount(), 1);

      const rows = await getAllRows();

      assert.strictEqual(rows.length, 2);
      assert.strictEqual(publishedEvents('url.fetch.completed').length, 1);
    });

    it('skips the fetch but emits fetch completed when the cached response is still fresh', async () => {
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(10, 'minutes').toDate(),
          requestInitiatedAt: dayjs().subtract(10, 'minutes').toDate(),
          response: {
            statusCode: 200,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {
              'cache-control': 'public, max-age=3600',
              date: dayjs().subtract(10, 'minutes').toDate().toUTCString(),
            },
            body: null,
          },
        }),
      ]);

      await runBatch([{ url: feedUrl }], 100);

      assert.strictEqual(fetchAndSaveResponse.mock.callCount(), 0);
      assert.strictEqual(publishedEvents('url.fetch.completed').length, 1);
    });
  });

  describe('bulk recovery', () => {
    // The epoch is an hour in the past so seeded rows can predate or follow it.
    let recoveryStartedAt: number;

    beforeEach(() => {
      recoveryStartedAt = Date.now() - 3_600_000;
    });

    const runRecoveryBatch = async (): Promise<void> => {
      await runBatch([
        { url: feedUrl, recovery: { startedAt: recoveryStartedAt } },
      ]);
    };

    it('performs a fresh request despite terminal-failure history and a still-fresh cached response', async () => {
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs(recoveryStartedAt).subtract(1, 'hour').toDate(),
          requestInitiatedAt: dayjs(recoveryStartedAt)
            .subtract(1, 'hour')
            .toDate(),
          response: {
            statusCode: 200,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {
              'cache-control': 'public, max-age=3600',
              date: new Date().toUTCString(),
            },
            body: null,
          },
        }),
        ...Array.from({ length: 5 }, (_, i) =>
          buildInsert({
            createdAt: dayjs(recoveryStartedAt)
              .subtract(30 - i, 'minutes')
              .toDate(),
            nextRetryDate: dayjs().add(1, 'hour').toDate(),
          }),
        ),
      ]);
      fetchAndSaveResponse.mock.mockImplementation(async () => ({
        request: buildInsert({
          status: RequestStatus.OK,
          response: {
            statusCode: 200,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {},
            body: null,
          },
        }),
      }));

      await runRecoveryBatch();

      assert.strictEqual(fetchAndSaveResponse.mock.callCount(), 1);

      const rows = await getAllRows();

      assert.strictEqual(rows.length, 7);
      assert.strictEqual(rows[rows.length - 1].status, RequestStatus.OK);

      assert.strictEqual(publishedEvents('url.fetch.completed').length, 1);
      assert.partialDeepStrictEqual(publish.mock.calls[0].arguments, [
        'url.fetch.completed',
        {
          data: {
            url: feedUrl,
            recovery: { startedAt: recoveryStartedAt },
          },
        },
      ]);
    });

    it('fetches despite terminal-failure history: the backoff derives from request rows, not counts', async () => {
      await seedRequests(
        Array.from({ length: 11 }, () =>
          buildInsert({
            createdAt: dayjs(recoveryStartedAt)
              .subtract(30, 'minutes')
              .toDate(),
            nextRetryDate: dayjs().add(1, 'hour').toDate(),
          }),
        ),
      );
      fetchAndSaveResponse.mock.mockImplementation(async () => ({
        request: buildInsert({ status: RequestStatus.OK }),
      }));

      await runRecoveryBatch();

      assert.strictEqual(fetchAndSaveResponse.mock.callCount(), 1);
      assert.strictEqual(publishedEvents('url.failed.disable-feeds').length, 0);
    });

    it('persists the backoff interval on the failure row as observability', async () => {
      fetchAndSaveResponse.mock.mockImplementation(async () => ({
        request: buildInsert(),
      }));

      await runRecoveryBatch();

      const rows = await getAllRows();

      assert.strictEqual(rows.length, 1);

      // Active phase: the next attempt is the feed's own cadence away
      // (rateSeconds 1800 → ~30 minutes).
      const recordedRetry = dayjs(rows[0].next_retry_date);

      assert.ok(recordedRetry.diff(dayjs(), 'minute') >= 29);
      assert.ok(recordedRetry.diff(dayjs(), 'minute') <= 31);

      // The active phase never skips: an immediate re-run fetches again.
      await runRecoveryBatch();

      assert.strictEqual(fetchAndSaveResponse.mock.callCount(), 2);
    });

    it('still expires when a recovery marker arrives; revival is the force flag\'s job', async () => {
      const shortBackoffListener = createShortBackoffListener();

      await seedRequests([
        buildInsert({ createdAt: dayjs().subtract(1, 'hour').toDate() }),
      ]);

      await shortBackoffListener.onBrokerFetchRequestBatchHandler({
        timestamp: Date.now(),
        rateSeconds: 1800,
        data: [
          { url: feedUrl, recovery: { startedAt: recoveryStartedAt } },
        ],
      } as unknown as Parameters<
        typeof listener.onBrokerFetchRequestBatchHandler
      >[0]);

      assert.strictEqual(fetchAndSaveResponse.mock.callCount(), 0);
      assert.strictEqual(publishedEvents('url.failed.disable-feeds').length, 1);
    });
  });

  describe('getLatestRequestWithOkStatus', () => {
    // Regression: the previous ORM's raw SQL returned timestamptz columns as
    // strings, so the store must convert them before handing them to callers
    // that call Date methods on them.
    it('returns createdAt and requestInitiatedAt as Date instances', async () => {
      const requestedAt = dayjs().subtract(10, 'minutes').toDate();

      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: requestedAt,
          requestInitiatedAt: requestedAt,
          response: {
            statusCode: 200,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: { date: requestedAt.toUTCString() },
            body: null,
          },
        }),
      ]);

      const result = await createPartitionedRequestsStore(
        getTestPool(),
      ).getLatestRequestWithOkStatus(feedUrl, {
        fields: ['response_headers'],
      });

      assert.ok(result);
      assert.ok(result.createdAt instanceof Date);
      assert.strictEqual(
        result.createdAt.toISOString(),
        requestedAt.toISOString(),
      );
      assert.ok(result.requestInitiatedAt instanceof Date);
      assert.strictEqual(
        result.requestInitiatedAt.toISOString(),
        requestedAt.toISOString(),
      );
      assert.strictEqual(typeof result.responseHeaders?.date, 'string');
    });

    it('returns null requestInitiatedAt when the row has none', async () => {
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: new Date(),
          requestInitiatedAt: null,
        }),
      ]);

      const result = await createPartitionedRequestsStore(
        getTestPool(),
      ).getLatestRequestWithOkStatus(feedUrl, {});

      assert.ok(result);
      assert.strictEqual(result.requestInitiatedAt, null);
    });
  });

  describe('getBackoffDecision', () => {
    // Compressed boundaries keep every seeded row inside the current month's
    // partition: suspension starts at 2h, tier 1 probes hourly until 3h, then
    // 6-hourly until expiry.
    const compressedBackoffConfig: BackoffConfig = {
      ...backoffConfig,
      suspensionBaseMs: 2 * 60 * 60 * 1000,
      tier1BoundaryMs: 3 * 60 * 60 * 1000,
      tier2BoundaryMs: 6 * 60 * 60 * 1000,
      expiryMs: 14 * 24 * 60 * 60 * 1000,
    };
    const compressedPolicies = () =>
      createScheduledFetchPolicies({
        backoffConfig: compressedBackoffConfig,
        partitionedRequestsStore: createPartitionedRequestsStore(getTestPool()),
      });

    it('should not skip a URL with no history', async () => {
      const { skip, expired } = await compressedPolicies().getBackoffDecision({
        url: feedUrl,
        rateSeconds: 1800,
      });

      assert.strictEqual(skip, false);
      assert.strictEqual(expired, false);
    });

    it('should not skip while the URL is in the active phase', async () => {
      await seedRequests([
        buildInsert({ status: RequestStatus.OK, createdAt: new Date() }),
      ]);

      const { skip } = await compressedPolicies().getBackoffDecision({
        url: feedUrl,
        rateSeconds: 1800,
      });

      assert.strictEqual(skip, false);
    });

    it('should skip a suspended URL whose tier has not elapsed', async () => {
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(150, 'minutes').toDate(),
        }),
        buildInsert({
          createdAt: dayjs().subtract(20, 'minutes').toDate(),
        }),
      ]);

      const { skip, nextRetryDate } = await compressedPolicies().getBackoffDecision(
        { url: feedUrl, rateSeconds: 1800 },
      );

      // elapsed 150min ≥ suspension (2h) and < tier1 (3h) → hourly probes;
      // the last attempt was 20 minutes ago, so the probe waits ~40 minutes.
      assert.strictEqual(skip, true);
      assert.ok(nextRetryDate);
      assert.ok(nextRetryDate!.getTime() > Date.now());
    });

    it('should not skip a suspended URL once its probe tier elapses', async () => {
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(150, 'minutes').toDate(),
        }),
        buildInsert({
          createdAt: dayjs().subtract(65, 'minutes').toDate(),
        }),
      ]);

      const { skip } = await compressedPolicies().getBackoffDecision({
        url: feedUrl,
        rateSeconds: 1800,
      });

      assert.strictEqual(skip, false);
    });

    it('should skip and flag expiry once the time since the last success runs out', async () => {
      const expiringPolicies = createScheduledFetchPolicies({
        backoffConfig: { ...compressedBackoffConfig, expiryMs: 30 * 60 * 1000 },
        partitionedRequestsStore: createPartitionedRequestsStore(getTestPool()),
      });

      await seedRequests([
        buildInsert({ createdAt: dayjs().subtract(1, 'hour').toDate() }),
      ]);

      const { skip, expired, elapsedMs } = await expiringPolicies.getBackoffDecision(
        { url: feedUrl, rateSeconds: 1800 },
      );

      assert.strictEqual(skip, true);
      assert.strictEqual(expired, true);
      assert.ok(elapsedMs >= 30 * 60 * 1000);
    });

    it('should rate-limit-floor a 429 even in the active phase', async () => {
      // Success 5 minutes ago, headerless 429 two minutes ago: the active
      // phase alone would fetch on the next tick, but the 429 floor pushes
      // the attempt an hour out.
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(5, 'minutes').toDate(),
        }),
        buildInsert({
          createdAt: dayjs().subtract(2, 'minutes').toDate(),
          response: {
            statusCode: 429,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {},
            body: null,
          },
        }),
      ]);

      const { skip } = await compressedPolicies().getBackoffDecision({
        url: feedUrl,
        rateSeconds: 1800,
      });

      assert.strictEqual(skip, true);
    });

    it('should never skip an active-phase failure (capped cadence)', async () => {
      // The original bug this backoff replaces: a plain 404 used to schedule
      // the next attempt minutes-to-hours out. Active-phase failures now
      // always fetch on the next tick.
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(5, 'minutes').toDate(),
        }),
        buildInsert({
          createdAt: dayjs().subtract(2, 'minutes').toDate(),
        }),
      ]);

      const { skip } = await compressedPolicies().getBackoffDecision({
        url: feedUrl,
        rateSeconds: 1800,
      });

      assert.strictEqual(skip, false);
    });

    it('should force through the backoff for bulk-retry fetches', async () => {
      await seedRequests([
        buildInsert({ createdAt: dayjs().subtract(1, 'hour').toDate() }),
      ]);

      const { skip, expired } = await compressedPolicies().getBackoffDecision({
        url: feedUrl,
        rateSeconds: 1800,
        force: true,
      });

      assert.strictEqual(skip, false);
      assert.strictEqual(expired, false);
    });
  });
});
