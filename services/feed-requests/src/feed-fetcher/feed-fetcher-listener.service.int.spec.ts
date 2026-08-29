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
    // The partitioned-requests store uses raw SQL, which resolves through the
    // connection's default search path rather than the ORM schema. Run against
    // a dedicated database so the real dev tables in `public` are never touched.
    const testDbUrl = new URL(config().FEED_REQUESTS_POSTGRES_URI);
    testDbUrl.pathname = '/feedrequests-test';

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Client } = require('pg');
    const adminClient = new Client({
      connectionString: config().FEED_REQUESTS_POSTGRES_URI,
    });
    await adminClient.connect();
    const dbExists = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      ['feedrequests-test'],
    );

    if (dbExists.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "feedrequests-test"`);
    }

    await adminClient.end();

    orm = await MikroORM.init({
      entities: ['dist/**/*.entity.js'],
      entitiesTs: ['src/**/*.entity.ts'],
      clientUrl: testDbUrl.toString(),
      type: 'postgresql',
      forceUtcTimezone: true,
      timezone: 'UTC',
      allowGlobalContext: true,
    });

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

    await recreatePartitionedTables();
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
    await dropPartitionedTables();
    await orm.close();
  });

  const recreatePartitionedTables = async () => {
    await dropPartitionedTables();

    const connection = orm.em.getConnection();

    await connection.execute(
      `CREATE TYPE request_partitioned_status AS ENUM ('OK', 'INTERNAL_ERROR', 'FETCH_ERROR', 'PARSE_ERROR', 'BAD_STATUS_CODE', 'FETCH_TIMEOUT', 'REFUSED_LARGE_FEED', 'MATCHED_HASH', 'INVALID_SSL_CERTIFICATE');`,
    );
    await connection.execute(
      `CREATE TYPE request_partitioned_source AS ENUM ('SHEDULE');`,
    );
    await connection.execute(
      `CREATE TABLE request_partitioned (
        id TEXT NOT NULL,
        status request_partitioned_status NOT NULL,
        source request_partitioned_source DEFAULT NULL NULL,
        fetch_options JSON DEFAULT NULL NULL,
        url TEXT NOT NULL,
        url_hash TEXT DEFAULT NULL NULL,
        host_hash TEXT DEFAULT NULL NULL,
        lookup_key TEXT DEFAULT NULL NULL,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        next_retry_date TIMESTAMPTZ DEFAULT NULL NULL,
        error_message TEXT DEFAULT NULL NULL,
        response_status_code INT DEFAULT NULL NULL,
        response_text_hash TEXT DEFAULT NULL NULL,
        response_body_hash_key TEXT DEFAULT NULL NULL,
        response_s3object_key TEXT DEFAULT NULL NULL,
        response_redis_cache_key TEXT DEFAULT NULL NULL,
        response_headers JSON DEFAULT NULL NULL,
        request_initiated_at TIMESTAMPTZ DEFAULT NULL NULL,
        PRIMARY KEY (id, created_at)
      );`,
    );
    await connection.execute(
      `CREATE INDEX request_partitioned_lookupkey_created_at_status_index ON request_partitioned (lookup_key, created_at, status);`,
    );
  };

  const dropPartitionedTables = async () => {
    const connection = orm.em.getConnection();

    await connection.execute(
      `DROP TABLE IF EXISTS request_partitioned CASCADE;`,
    );
    await connection.execute(
      `DROP TYPE IF EXISTS request_partitioned_status CASCADE;`,
    );
    await connection.execute(
      `DROP TYPE IF EXISTS request_partitioned_source CASCADE;`,
    );
  };

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
