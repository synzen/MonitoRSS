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
  calculateNextRetryDate,
  createScheduledFetchPolicies,
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
  const maxFailAttempts = 11;

  // nock cannot intercept undici.request, so the HTTP layer is stubbed at the
  // FeedFetcherService seam; everything around it (locks, dedupe, failure
  // counting, backoff, flush, event emission) runs for real.
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
      maxFailAttempts,
      feedFetcher: { fetchAndSaveResponse } as never,
      partitionedRequestsStore: createPartitionedRequestsStore(getTestPool()),
      hostRateLimiter: createHostRateLimiterService(
        cacheStorageService as never,
      ) as never,
      cacheStorage: cacheStorageService as never,
      publish: publish as never,
    });
    policies = createScheduledFetchPolicies({
      maxFailAttempts,
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

    it('does not process the event if at failure retry count', async () => {
      await seedRequests(
        Array.from({ length: 11 }, () =>
          buildInsert({
            status: RequestStatus.BAD_STATUS_CODE,
            createdAt: dayjs().subtract(1, 'day').toDate(),
            nextRetryDate: dayjs().subtract(1, 'hour').toDate(),
          }),
        ),
      );

      await runBatch([{ url: feedUrl }], 100);

      assert.strictEqual(fetchAndSaveResponse.mock.callCount(), 0);
    });

    it('emits a failed url if at failure retry count', async () => {
      await seedRequests(
        Array.from({ length: 11 }, () =>
          buildInsert({
            status: RequestStatus.BAD_STATUS_CODE,
            createdAt: dayjs().subtract(1, 'day').toDate(),
            nextRetryDate: dayjs().subtract(1, 'hour').toDate(),
          }),
        ),
      );

      await runBatch([{ url: feedUrl }], 100);

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

    it('does not count failures recorded before the recovery cycle toward the threshold', async () => {
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

    it('persists the exponential backoff after a failed recovery attempt and skips until it elapses', async () => {
      fetchAndSaveResponse.mock.mockImplementation(async () => ({
        request: buildInsert(),
      }));

      await runRecoveryBatch();

      let rows = await getAllRows();

      assert.strictEqual(rows.length, 1);

      const firstBackoff = dayjs(rows[0].next_retry_date);

      assert.ok(firstBackoff.diff(dayjs(), 'minute') >= 4);
      assert.ok(firstBackoff.diff(dayjs(), 'minute') <= 6);

      // An immediate retry of the same recovery cycle honors the backoff.
      await runRecoveryBatch();

      assert.strictEqual(fetchAndSaveResponse.mock.callCount(), 1);

      // Once the backoff elapses, the next attempt proceeds and the backoff
      // grows exponentially (5 * 2^1 minutes for the second fresh failure).
      await getTestPool().query(
        `UPDATE request_partitioned SET next_retry_date = NOW() - INTERVAL '1 second'`,
      );

      await runRecoveryBatch();

      assert.strictEqual(fetchAndSaveResponse.mock.callCount(), 2);

      rows = await getAllRows();

      assert.strictEqual(rows.length, 2);

      const secondBackoff = dayjs(rows[rows.length - 1].next_retry_date);

      assert.ok(secondBackoff.diff(dayjs(), 'minute') >= 9);
      assert.ok(secondBackoff.diff(dayjs(), 'minute') <= 11);
    });

    it('returns the recovery cycle to the failed state when the fresh cycle exhausts the threshold', async () => {
      await seedRequests(
        Array.from({ length: 11 }, () =>
          buildInsert({
            createdAt: dayjs(recoveryStartedAt).add(1, 'minute').toDate(),
            nextRetryDate: dayjs().subtract(1, 'minute').toDate(),
          }),
        ),
      );

      await runRecoveryBatch();

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

  describe('shouldSkipAfterPreviousFailedAttempt', () => {
    it('should return false if no previous attempt', async () => {
      const { skip, failedAttemptsCount } =
        await policies.shouldSkipAfterPreviousFailedAttempt({
          url: feedUrl,
        });

      assert.strictEqual(skip, false);
      assert.strictEqual(failedAttemptsCount, 0);
    });

    it('should return false if latest attempt was successful', async () => {
      await seedRequests([
        buildInsert({ status: RequestStatus.OK, createdAt: new Date() }),
      ]);

      const { skip } = await policies.shouldSkipAfterPreviousFailedAttempt({
        url: feedUrl,
      });

      assert.strictEqual(skip, false);
    });

    it('should skip if the found latest retry date is in the future', async () => {
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(30, 'minutes').toDate(),
        }),
        buildInsert({
          createdAt: dayjs().subtract(20, 'minutes').toDate(),
          nextRetryDate: dayjs().add(30, 'minutes').toDate(),
        }),
      ]);

      const { skip } = await policies.shouldSkipAfterPreviousFailedAttempt({
        url: feedUrl,
      });

      assert.strictEqual(skip, true);
    });

    it('should not skip if the found latest retry date is in the past', async () => {
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(30, 'minutes').toDate(),
        }),
        buildInsert({
          createdAt: dayjs().subtract(20, 'minutes').toDate(),
          nextRetryDate: dayjs().subtract(10, 'minutes').toDate(),
        }),
      ]);

      const { skip } = await policies.shouldSkipAfterPreviousFailedAttempt({
        url: feedUrl,
      });

      assert.strictEqual(skip, false);
    });
  });

  describe('countFailedRequests', () => {
    it('should return the number of failed requests after the latest OK attempt', async () => {
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(30, 'days').toDate(),
        }),
        buildInsert({
          createdAt: dayjs().subtract(20, 'days').toDate(),
        }),
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(30, 'minutes').toDate(),
        }),
        buildInsert({
          createdAt: dayjs().subtract(20, 'minutes').toDate(),
        }),
        buildInsert({
          createdAt: dayjs().subtract(10, 'minutes').toDate(),
        }),
      ]);

      const failedRequestsCount = await policies.countFailedRequests({
        url: feedUrl,
      });

      assert.strictEqual(failedRequestsCount, 2);
    });

    it('should return 0 if there are no failed requests after the latest OK attempt', async () => {
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(30, 'days').toDate(),
        }),
        buildInsert({
          createdAt: dayjs().subtract(20, 'days').toDate(),
        }),
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(30, 'minutes').toDate(),
        }),
      ]);

      const failedRequestsCount = await policies.countFailedRequests({
        url: feedUrl,
      });

      assert.strictEqual(failedRequestsCount, 0);
    });
  });

  describe('calculateNextRetryDate', () => {
    const referenceDate = new Date();

    for (const { attemptsSoFar, expected } of [
      {
        attemptsSoFar: 0,
        expected: dayjs(referenceDate).add(5, 'minutes').toDate(),
      },
      {
        attemptsSoFar: 1,
        expected: dayjs(referenceDate).add(10, 'minutes').toDate(),
      },
      {
        attemptsSoFar: 2,
        expected: dayjs(referenceDate).add(20, 'minutes').toDate(),
      },
      {
        attemptsSoFar: 3,
        expected: dayjs(referenceDate).add(40, 'minutes').toDate(),
      },
    ]) {
      it(`returns correctly on attempt #${attemptsSoFar}`, () => {
        const returned = calculateNextRetryDate(referenceDate, attemptsSoFar);

        assert.deepStrictEqual(returned, expected);
      });
    }
  });
});
