import { randomUUID } from 'crypto';
import dayjs from 'dayjs';
import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert';
import { RequestStatus, RequestSource } from '../../shared/types';
import { createPartitionedRequestsStore } from './partitioned-requests-store';
import type { PartitionedRequestInsert } from '../../shared/types';
import {
  recreatePartitionedTables,
  setupPostgresTests,
  teardownPostgresTests,
  getTestPool,
} from './setup-postgres-tests';
import { silenceLogger } from '../../test/helpers/silence-logger';

silenceLogger();

describe('PartitionedRequestsStore (Integration)', () => {
  const url = 'https://rss-feed.com/feed.xml';

  before(async () => {
    await setupPostgresTests();
  });

  afterEach(async () => {
    await recreatePartitionedTables();
  });

  after(async () => {
    await teardownPostgresTests();
  });

  const buildInsert = (
    overrides: Partial<PartitionedRequestInsert> = {},
  ): PartitionedRequestInsert => ({
    id: randomUUID(),
    status: RequestStatus.OK,
    source: RequestSource.Schedule,
    fetchOptions: null,
    url,
    lookupKey: url,
    createdAt: new Date(),
    nextRetryDate: null,
    errorMessage: null,
    requestInitiatedAt: new Date(),
    response: null,
    ...overrides,
  });

  describe('flushInserts', () => {
    it('persists inserts with responses and reads them back', async () => {
      const store = createPartitionedRequestsStore(getTestPool());

      await store.flushInserts([
        buildInsert({
          response: {
            statusCode: 200,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: { 'content-type': 'application/xml' },
            body: {
              hashKey: randomUUID(),
              contents: Buffer.from('feed contents').toString('base64'),
            },
          },
        }),
      ]);

      const readBack = await store.getLatestRequestWithResponseBody(url);

      assert.ok(readBack);
      assert.strictEqual(readBack.status, RequestStatus.OK);
      assert.strictEqual(readBack.response?.statusCode, 200);
    });

    it('dedupes response bodies by hash key', async () => {
      const store = createPartitionedRequestsStore(getTestPool());
      const bodyHashKey = randomUUID();
      const contents = Buffer.from('shared contents').toString('base64');

      const first = buildInsert({
        response: {
          statusCode: 200,
          textHash: null,
          s3ObjectKey: null,
          redisCacheKey: null,
          headers: {},
          body: { hashKey: bodyHashKey, contents },
        },
      });
      const second = buildInsert({
        createdAt: dayjs().add(1, 'minute').toDate(),
        response: {
          statusCode: 200,
          textHash: null,
          s3ObjectKey: null,
          redisCacheKey: null,
          headers: {},
          body: { hashKey: bodyHashKey, contents },
        },
      });

      await store.flushInserts([first]);
      await store.flushInserts([second]);

      // One shared body row, two request rows referencing it
      const bodyRows = await getTestPool().query(
        `SELECT count(*)::int AS count FROM response_bodies WHERE hash_key = $1`,
        [bodyHashKey],
      );
      const requestRows = await getTestPool().query(
        `SELECT count(*)::int AS count FROM request_partitioned WHERE response_body_hash_key = $1`,
        [bodyHashKey],
      );

      assert.strictEqual(bodyRows.rows[0].count, 1);
      assert.strictEqual(requestRows.rows[0].count, 2);
    });

    it('rolls back the whole flush when an insert fails', async () => {
      const store = createPartitionedRequestsStore(getTestPool());
      const badInsert = buildInsert({
        // Force a failure: id exceeding the column's text length is not
        // possible, so violate the status enum instead.
        status: 'NOT_A_STATUS' as never,
      });

      await assert.rejects(() => store.flushInserts([badInsert]));

      const rows = await getTestPool().query(
        `SELECT count(*)::int AS count FROM request_partitioned`,
      );

      assert.strictEqual(rows.rows[0].count, 0);
    });
  });

  describe('wasRequestedInPastSeconds', () => {
    it('returns true for a request within the window and false outside it', async () => {
      const store = createPartitionedRequestsStore(getTestPool());

      await store.flushInserts([
        buildInsert({
          createdAt: dayjs().subtract(30, 'seconds').toDate(),
        }),
      ]);

      assert.strictEqual(await store.wasRequestedInPastSeconds(url, 60), true);
      assert.strictEqual(await store.wasRequestedInPastSeconds(url, 10), false);
      assert.strictEqual(
        await store.wasRequestedInPastSeconds('other-key', 60),
        false,
      );
    });
  });

  describe('getRequests', () => {
    it('paginates newest-first and filters by date', async () => {
      const store = createPartitionedRequestsStore(getTestPool());

      await store.flushInserts([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(30, 'minutes').toDate(),
        }),
        buildInsert({
          status: RequestStatus.BAD_STATUS_CODE,
          createdAt: dayjs().subtract(20, 'minutes').toDate(),
        }),
        buildInsert({
          status: RequestStatus.BAD_STATUS_CODE,
          createdAt: dayjs().subtract(10, 'minutes').toDate(),
        }),
      ]);

      const page = await store.getRequests({ skip: 1, limit: 1, url });

      assert.strictEqual(page.length, 1);
      assert.strictEqual(page[0].status, RequestStatus.BAD_STATUS_CODE);
      assert.strictEqual(page[0].response, null);
      assert.ok(page[0].id);
      assert.ok(page[0].createdAt instanceof Date);
      assert.ok(page[0].finishedAt instanceof Date);

      const afterDate = dayjs().subtract(15, 'minutes').toISOString();
      const filtered = await store.getRequests({
        skip: 0,
        limit: 10,
        url,
        afterDate,
      });

      assert.strictEqual(filtered.length, 1);

      const byLookupKey = await store.getRequests({
        skip: 0,
        limit: 10,
        url: 'https://unrelated.com/feed.xml',
        lookupKey: url,
      });

      assert.strictEqual(byLookupKey.length, 3);
    });
  });

  describe('latest-request lookups', () => {
    it('getLatestRequestWithResponseBody skips requests without stored bodies', async () => {
      const store = createPartitionedRequestsStore(getTestPool());

      await store.flushInserts([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(10, 'minutes').toDate(),
          response: {
            statusCode: 200,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {},
            body: {
              hashKey: randomUUID(),
              contents: Buffer.from('older body').toString('base64'),
            },
          },
        }),
        // Newer request without a body must not be returned
        buildInsert({
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
      ]);

      const latest = await store.getLatestRequestWithResponseBody(url);

      assert.ok(latest);
      assert.ok(latest.response?.content);
    });

    it('getLatestRequestNon304 returns the latest request including errors', async () => {
      const store = createPartitionedRequestsStore(getTestPool());

      await store.flushInserts([
        buildInsert({
          status: RequestStatus.BAD_STATUS_CODE,
          response: {
            statusCode: 500,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {},
            body: null,
          },
        }),
      ]);

      const latest = await store.getLatestRequestNon304(url);

      assert.ok(latest);
      assert.strictEqual(latest.status, RequestStatus.BAD_STATUS_CODE);
      assert.strictEqual(latest.response?.statusCode, 500);
    });

    it('getLatestRequestAnyStatus returns 304 requests too', async () => {
      const store = createPartitionedRequestsStore(getTestPool());

      await store.flushInserts([
        buildInsert({
          response: {
            statusCode: 304,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {},
            body: null,
          },
        }),
      ]);

      const latest = await store.getLatestRequestAnyStatus(url);

      assert.ok(latest);
      assert.strictEqual(latest.response?.statusCode, 304);
      // No 304-filtered lookup should return it
      assert.strictEqual(await store.getLatestRequestNon304(url), null);
      assert.strictEqual(
        await store.getLatestRequestWithResponseBody(url),
        null,
      );
    });
  });

  describe('failure bookkeeping', () => {
    it('getLatestNextRetryDate returns the newest non-null retry date', async () => {
      const store = createPartitionedRequestsStore(getTestPool());
      const retryDate = dayjs().add(10, 'minutes').toDate();

      await store.flushInserts([
        buildInsert({
          status: RequestStatus.FETCH_ERROR,
          nextRetryDate: dayjs().subtract(5, 'minutes').toDate(),
        }),
        buildInsert({
          status: RequestStatus.FETCH_ERROR,
          createdAt: dayjs().add(1, 'minute').toDate(),
          nextRetryDate: retryDate,
        }),
      ]);

      assert.deepStrictEqual(
        await store.getLatestNextRetryDate(url),
        retryDate,
      );

      // The since filter includes rows created at/after the cutoff: a cutoff
      // between the two rows selects only the newer one.
      assert.deepStrictEqual(
        await store.getLatestNextRetryDate(
          url,
          dayjs().add(30, 'seconds').toDate(),
        ),
        retryDate,
      );
      assert.strictEqual(
        await store.getLatestNextRetryDate(
          url,
          dayjs().add(2, 'minute').toDate(),
        ),
        null,
      );
    });

    it('countFailedRequests counts failed statuses, optionally since a time', async () => {
      const store = createPartitionedRequestsStore(getTestPool());

      await store.flushInserts([
        buildInsert({
          status: RequestStatus.FETCH_ERROR,
          createdAt: dayjs().subtract(20, 'minutes').toDate(),
        }),
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(10, 'minutes').toDate(),
        }),
        buildInsert({
          status: RequestStatus.FETCH_TIMEOUT,
          createdAt: dayjs().subtract(5, 'minutes').toDate(),
        }),
      ]);

      // Without a since cutoff every failed row counts; the listener supplies
      // the latest-OK cutoff itself.
      assert.strictEqual(await store.countFailedRequests(url), 2);
      assert.strictEqual(
        await store.countFailedRequests(
          url,
          dayjs().subtract(15, 'minutes').toDate(),
        ),
        1,
      );
      assert.strictEqual(
        await store.countFailedRequests(
          url,
          dayjs().subtract(30, 'minutes').toDate(),
        ),
        2,
      );
      assert.strictEqual(
        await store.countFailedRequests(
          url,
          dayjs().subtract(3, 'minutes').toDate(),
        ),
        0,
      );
    });

    it('getLatestStatusAfterTime reads the newest scheduled request', async () => {
      const store = createPartitionedRequestsStore(getTestPool());

      await store.flushInserts([
        buildInsert({
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(5, 'minutes').toDate(),
        }),
        buildInsert({
          status: RequestStatus.BAD_STATUS_CODE,
          createdAt: dayjs().subtract(1, 'minutes').toDate(),
          source: null,
        }),
      ]);

      const result = await store.getLatestStatusAfterTime(
        url,
        dayjs().subtract(10, 'minutes').toDate(),
      );

      // Only SHEDULE-sourced rows qualify; the source-less row is ignored
      assert.deepStrictEqual(result, { status: RequestStatus.OK });
    });
  });
});
