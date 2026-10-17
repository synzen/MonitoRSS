/* eslint-disable max-len */
// Polyfill for Jest VM environment (redis v4 depends on undici which needs these)
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';

Object.assign(globalThis, {
  ReadableStream,
  WritableStream,
  TransformStream,
});

import { MikroORM } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import dayjs from 'dayjs';
import { RequestStatus } from './constants';
import { RequestSource } from './constants/request-source.constants';
import { FeedFetcherListenerService } from './feed-fetcher-listener.service';
import PartitionedRequestsStoreService from '../partitioned-requests-store/partitioned-requests-store.service';
import { PartitionedRequestInsert } from '../partitioned-requests-store/types/partitioned-request.type';
import { HostRateLimiterService } from '../host-rate-limiter/host-rate-limiter.service';
import {
  recreatePartitionedTables,
  setupPostgresTests,
  teardownPostgresTests,
} from '../shared/utils/setup-postgres-tests';
import config from '../config';

jest.mock('../utils/logger');

describe('FeedFetcherListenerService (Integration)', () => {
  let service: FeedFetcherListenerService;
  let orm: MikroORM;
  const feedUrl = 'https://rss-feed.com/feed.xml';

  // nock cannot intercept undici.request, so the HTTP layer is stubbed at the
  // FeedFetcherService seam; everything around it (locks, dedupe, failure
  // counting, backoff, flush, event emission) runs for real.
  const fetchAndSaveResponse = jest.fn();
  const amqpConnection = {
    publish: jest.fn(),
  };
  const cacheStorageService = {
    setNX: jest.fn(),
    del: jest.fn(),
    increment: jest.fn(),
  };

  beforeAll(async () => {
    const configVals = config();
    const configService = {
      get: (key: string) => configVals[key as keyof typeof configVals],
      getOrThrow: (key: string) => {
        const value = configVals[key as keyof typeof configVals];

        if (value === undefined) {
          throw new Error(`Missing config value ${key}`);
        }

        return value;
      },
    };

    orm = await setupPostgresTests();

    service = new FeedFetcherListenerService(
      configService as never,
      { fetchAndSaveResponse } as never,
      amqpConnection as never,
      orm,
      orm.em as never,
      new PartitionedRequestsStoreService(orm),
      new HostRateLimiterService(cacheStorageService as never),
      cacheStorageService as never,
    );
  });

  beforeEach(async () => {
    cacheStorageService.setNX.mockResolvedValue(true);
    cacheStorageService.del.mockResolvedValue(undefined);
    cacheStorageService.increment.mockResolvedValue(1);
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await recreatePartitionedTables();
  });

  afterAll(async () => {
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
    await new PartitionedRequestsStoreService(orm).flushInserts(inserts);
  };

  const getAllRows = async (): Promise<
    Array<{
      id: string;
      status: string;
      created_at: Date;
      next_retry_date: Date | null;
    }>
  > => {
    return orm.em
      .getConnection()
      .execute(
        `SELECT id, status, created_at, next_retry_date FROM request_partitioned ORDER BY created_at ASC, id ASC`,
      );
  };

  const publishedEvents = (queue: string) =>
    amqpConnection.publish.mock.calls.filter((call) => call[1] === queue);

  const runBatch = async (
    data: unknown[],
    rateSeconds = 1800,
  ): Promise<void> => {
    await service.onBrokerFetchRequestBatch({
      timestamp: Date.now(),
      rateSeconds,
      data,
    } as unknown as Parameters<typeof service.onBrokerFetchRequestBatch>[0]);
  };

  describe('onBrokerFetchRequestBatch', () => {
    it('saves a failed attempt with a next retry date if failed', async () => {
      fetchAndSaveResponse.mockResolvedValue({
        request: buildInsert(),
      });

      await runBatch([{ url: feedUrl }], 100);

      const rows = await getAllRows();

      expect(rows).toHaveLength(1);
      expect(rows[0].status).toEqual(RequestStatus.FETCH_ERROR);
      expect(rows[0].next_retry_date).toBeDefined();
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

      expect(fetchAndSaveResponse).not.toHaveBeenCalled();
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

      expect(amqpConnection.publish).toHaveBeenCalledTimes(1);
      expect(amqpConnection.publish).toHaveBeenCalledWith(
        '',
        'url.failed.disable-feeds',
        expect.objectContaining({
          data: expect.objectContaining({ url: feedUrl }),
        }),
      );
    });

    // Regression: a scheduled fetch for a URL with prior OK history must not
    // throw when reading the cached response's timestamps back from raw SQL
    // (MikroORM v7 returns timestamptz as strings). A throw here silently
    // skipped every scheduled fetch in production.
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
      fetchAndSaveResponse.mockResolvedValue({
        request: buildInsert({ status: RequestStatus.OK }),
      });

      await runBatch([{ url: feedUrl }], 100);

      expect(fetchAndSaveResponse).toHaveBeenCalledTimes(1);

      const rows = await getAllRows();

      expect(rows).toHaveLength(2);
      expect(publishedEvents('url.fetch.completed')).toHaveLength(1);
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

      expect(fetchAndSaveResponse).not.toHaveBeenCalled();
      expect(publishedEvents('url.fetch.completed')).toHaveLength(1);
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
      fetchAndSaveResponse.mockResolvedValue({
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
      });

      await runRecoveryBatch();

      expect(fetchAndSaveResponse).toHaveBeenCalledTimes(1);

      const rows = await getAllRows();

      expect(rows).toHaveLength(7);
      expect(rows[rows.length - 1].status).toEqual(RequestStatus.OK);

      expect(publishedEvents('url.fetch.completed')).toHaveLength(1);
      expect(amqpConnection.publish).toHaveBeenCalledWith(
        '',
        'url.fetch.completed',
        expect.objectContaining({
          data: expect.objectContaining({
            url: feedUrl,
            recovery: { startedAt: recoveryStartedAt },
          }),
        }),
      );
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
      fetchAndSaveResponse.mockResolvedValue({
        request: buildInsert({ status: RequestStatus.OK }),
      });

      await runRecoveryBatch();

      expect(fetchAndSaveResponse).toHaveBeenCalledTimes(1);
      expect(publishedEvents('url.failed.disable-feeds')).toHaveLength(0);
    });

    it('persists the exponential backoff after a failed recovery attempt and skips until it elapses', async () => {
      fetchAndSaveResponse.mockImplementation(async () => ({
        request: buildInsert(),
      }));

      await runRecoveryBatch();

      let rows = await getAllRows();

      expect(rows).toHaveLength(1);

      const firstBackoff = dayjs(rows[0].next_retry_date);

      expect(firstBackoff.diff(dayjs(), 'minute')).toBeGreaterThanOrEqual(4);
      expect(firstBackoff.diff(dayjs(), 'minute')).toBeLessThanOrEqual(6);

      // An immediate retry of the same recovery cycle honors the backoff.
      await runRecoveryBatch();

      expect(fetchAndSaveResponse).toHaveBeenCalledTimes(1);

      // Once the backoff elapses, the next attempt proceeds and the backoff
      // grows exponentially (5 * 2^1 minutes for the second fresh failure).
      await orm.em
        .getConnection()
        .execute(
          `UPDATE request_partitioned SET next_retry_date = NOW() - INTERVAL '1 second'`,
        );

      await runRecoveryBatch();

      expect(fetchAndSaveResponse).toHaveBeenCalledTimes(2);

      rows = await getAllRows();

      expect(rows).toHaveLength(2);

      const secondBackoff = dayjs(rows[rows.length - 1].next_retry_date);

      expect(secondBackoff.diff(dayjs(), 'minute')).toBeGreaterThanOrEqual(9);
      expect(secondBackoff.diff(dayjs(), 'minute')).toBeLessThanOrEqual(11);
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

      expect(fetchAndSaveResponse).not.toHaveBeenCalled();
      expect(publishedEvents('url.failed.disable-feeds')).toHaveLength(1);
    });
  });

  describe('getLatestRequestWithOkStatus', () => {
    // Regression: MikroORM v7's raw SQL returns timestamptz columns as
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

      const result = await new PartitionedRequestsStoreService(
        orm,
      ).getLatestRequestWithOkStatus(feedUrl, {
        fields: ['response_headers'],
      });

      expect(result).not.toBeNull();
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.createdAt.toISOString()).toEqual(
        requestedAt.toISOString(),
      );
      expect(result!.requestInitiatedAt).toBeInstanceOf(Date);
      expect(result!.requestInitiatedAt!.toISOString()).toEqual(
        requestedAt.toISOString(),
      );
      expect(result!.responseHeaders).toMatchObject({
        date: expect.any(String),
      });
    });

    it('returns null requestInitiatedAt when the row has none', async () => {
      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: new Date(),
          requestInitiatedAt: null,
        }),
      ]);

      const result = await new PartitionedRequestsStoreService(
        orm,
      ).getLatestRequestWithOkStatus(feedUrl, {});

      expect(result).not.toBeNull();
      expect(result!.requestInitiatedAt).toBeNull();
    });
  });

  describe('shouldSkipAfterPreviousFailedAttempt', () => {
    it('should return false if no previous attempt', async () => {
      const { skip, failedAttemptsCount } =
        await service.shouldSkipAfterPreviousFailedAttempt({
          url: feedUrl,
        });

      expect(skip).toEqual(false);
      expect(failedAttemptsCount).toEqual(0);
    });

    it('should return false if latest attempt was successful', async () => {
      await seedRequests([
        buildInsert({ status: RequestStatus.OK, createdAt: new Date() }),
      ]);

      const { skip } = await service.shouldSkipAfterPreviousFailedAttempt({
        url: feedUrl,
      });

      expect(skip).toEqual(false);
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

      const { skip } = await service.shouldSkipAfterPreviousFailedAttempt({
        url: feedUrl,
      });

      expect(skip).toEqual(true);
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

      const { skip } = await service.shouldSkipAfterPreviousFailedAttempt({
        url: feedUrl,
      });

      expect(skip).toEqual(false);
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

      const failedRequestsCount = await service.countFailedRequests({
        url: feedUrl,
      });

      expect(failedRequestsCount).toEqual(2);
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

      const failedRequestsCount = await service.countFailedRequests({
        url: feedUrl,
      });

      expect(failedRequestsCount).toEqual(0);
    });
  });

  describe('calculateNextRetryDate', () => {
    const referenceDate = new Date();

    it.each([
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
    ])(
      'returns correctly on attempt #$attemptsSoFar',
      ({ attemptsSoFar, expected }) => {
        const returned = service.calculateNextRetryDate(
          referenceDate,
          attemptsSoFar,
        );

        expect(returned).toEqual(expected);
      },
    );
  });
});
