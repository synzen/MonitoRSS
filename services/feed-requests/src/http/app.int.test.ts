import { deflate } from 'zlib';
import { promisify } from 'util';
import dayjs from 'dayjs';
import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert';
import type { FastifyInstance } from 'fastify';
import { createApp } from './app';
import { createFeedFetcherService } from '../feed-fetcher/feed-fetcher';
import { createHostRateLimiterService } from '../host-rate-limiter/host-rate-limiter';
import { createPartitionedRequestsStore } from '../stores/postgres/partitioned-requests-store';
import {
  RequestSource,
  RequestStatus,
  type PartitionedRequestInsert,
} from '../shared/types';
import {
  truncatePartitionedTables,
  setupPostgresTests,
  teardownPostgresTests,
  getTestPool,
} from '../stores/postgres/setup-postgres-tests';
import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

const deflatePromise = promisify(deflate);

const API_KEY = 'test-api-key';
const url = 'https://example.com/feed.xml';

// Deterministic deflate('feed contents') — the seeded body contents and its
// sha1 (computed by the store over the exact seeded string) are hardcoded so
// expectations never recompute the code's own derivations.
const SEEDED_CONTENTS = 'eJxLS01NUUjOzytJzSspBgAiiAUj';
const SEEDED_CONTENTS_SHA1 = '091d9d3d99faee4adff2cd0673366bd34c72582b';

describe('HTTP app (Integration)', () => {
  let app: FastifyInstance;
  let store: ReturnType<typeof createPartitionedRequestsStore>;

  before(async () => {
    await setupPostgresTests();

    store = createPartitionedRequestsStore(getTestPool());

    // The read paths under test only touch decodeResponseContent (pure zlib)
    // and getLimitForUrl (pure in-memory map), so the storage collaborators
    // are never invoked and stay as dummies. Fetch-triggering paths are
    // covered by the mocked-deps unit suite (src/http/app.test.ts).
    const feedFetcher = createFeedFetcherService({
      defaultUserAgent: 'MonitoRSS',
      requestTimeoutMs: 15000,
      objectFileStorage: {} as never,
      cacheStorage: {} as never,
      partitionedRequestsStore: store,
    });
    const hostRateLimiter = createHostRateLimiterService({} as never);

    app = createApp({
      apiKey: API_KEY,
      feedFetcher,
      partitionedRequestsStore: store,
      hostRateLimiter,
    });
    await app.ready();
  });

  afterEach(async () => {
    await truncatePartitionedTables();
  });

  after(async () => {
    await app.close();
    await teardownPostgresTests();
  });

  const buildInsert = (
    overrides: Partial<PartitionedRequestInsert> = {},
  ): PartitionedRequestInsert => ({
    id: '11111111-1111-4111-8111-111111111111',
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

  describe('GET /v1/feed-requests', () => {
    it('renders a seeded history row from real pg types', async () => {
      // Fresh absolute dates keep the row inside the partitions the template
      // database creates; expectations derive from the seed value itself.
      const hourStart = dayjs().startOf('hour').toDate();
      const retryDate = dayjs(hourStart).add(10, 'minute').toDate();

      await store.flushInserts([
        buildInsert({
          status: RequestStatus.BAD_STATUS_CODE,
          createdAt: hourStart,
          requestInitiatedAt: hourStart,
          nextRetryDate: retryDate,
          fetchOptions: {
            userAgent: 'MonitoRSS',
            headers: { 'user-agent': 'MonitoRSS/1.0' },
          },
          response: {
            statusCode: 500,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {
              'content-type': 'application/xml',
              'cache-control': 'public, max-age=300',
            },
            body: null,
          },
        }),
      ]);

      const res = await app.inject({
        method: 'GET',
        url: `/v1/feed-requests?limit=10&skip=0&url=${encodeURIComponent(url)}`,
        headers: { 'api-key': API_KEY },
      });

      assert.strictEqual(res.statusCode, 200);

      const body = res.json();
      assert.deepStrictEqual(body.result.requests[0], {
        // request_partitioned.id is TEXT; the rendered id stays the string
        // that was seeded rather than a coerced number.
        id: '11111111-1111-4111-8111-111111111111',
        url,
        status: RequestStatus.BAD_STATUS_CODE,
        headers: { 'user-agent': 'MonitoRSS/1.0' },
        createdAt: Math.floor(hourStart.getTime() / 1000),
        createdAtIso: hourStart.toISOString(),
        finishedAtIso: hourStart.toISOString(),
        nextRetryAtIso: retryDate.toISOString(),
        response: {
          statusCode: 500,
          headers: {
            'content-type': 'application/xml',
            'cache-control': 'public, max-age=300',
          },
        },
        freshnessLifetimeMs: 300000,
      });
      assert.strictEqual(
        body.result.nextRetryTimestamp,
        Math.floor(retryDate.getTime() / 1000),
      );
      assert.strictEqual(body.result.feedHostGlobalRateLimit, null);
    });
  });

  describe('POST /v1/feed-requests/delivery-preview', () => {
    it('serves a fresh stored request without fetching', async () => {
      await store.flushInserts([
        buildInsert({
          lookupKey: 'lookup-key',
          status: RequestStatus.OK,
          response: {
            statusCode: 200,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {},
            body: {
              hashKey: '22222222-2222-4222-8222-222222222222',
              contents: SEEDED_CONTENTS,
            },
          },
        }),
      ]);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests/delivery-preview',
        headers: { 'api-key': API_KEY },
        payload: { url, lookupKey: 'lookup-key' },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(res.json(), {
        requestStatus: 'SUCCESS',
        response: {
          hash: SEEDED_CONTENTS_SHA1,
          body: 'feed contents',
          statusCode: 200,
        },
      });
    });

    it('falls back to the last body-bearing request when the latest is a 304', async () => {
      const previousBody = (
        await deflatePromise(Buffer.from('previous body'))
      ).toString('base64');

      await store.flushInserts([
        buildInsert({
          lookupKey: 'lookup-key-304',
          status: RequestStatus.OK,
          createdAt: dayjs().subtract(2, 'hour').toDate(),
          requestInitiatedAt: dayjs().subtract(2, 'hour').toDate(),
          response: {
            statusCode: 200,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {},
            body: {
              hashKey: '44444444-4444-4444-8444-444444444444',
              contents: previousBody,
            },
          },
        }),
        buildInsert({
          id: '55555555-5555-4555-8555-555555555555',
          lookupKey: 'lookup-key-304',
          status: RequestStatus.OK,
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

      const res = await app.inject({
        method: 'POST',
        url: '/v1/feed-requests/delivery-preview',
        headers: { 'api-key': API_KEY },
        payload: { url, lookupKey: 'lookup-key-304' },
      });

      assert.strictEqual(res.statusCode, 200);

      const body = res.json();
      // The hash derivation for this dynamically deflated body is pinned by
      // the hardcoded literal in the previous test; here only its presence
      // is asserted.
      assert.strictEqual(body.requestStatus, 'SUCCESS');
      assert.strictEqual(body.response.statusCode, 304);
      assert.strictEqual(body.response.body, 'previous body');
      assert.ok(
        typeof body.response.hash === 'string' && body.response.hash.length > 0,
      );
    });
  });
});
