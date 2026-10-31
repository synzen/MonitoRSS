import { randomUUID } from 'crypto';
import { deflate } from 'zlib';
import { promisify } from 'util';
import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert';
import { RequestStatus, RequestSource } from '../feed-fetcher/types';
import { createFeedFetcherService } from './feed-fetcher';
import { createPartitionedRequestsStore } from '../stores/postgres/partitioned-requests-store';
import type { PartitionedRequestInsert } from '../feed-fetcher/types';
import {
  truncatePartitionedTables,
  setupPostgresTests,
  teardownPostgresTests,
  getTestPool,
} from '../stores/postgres/setup-postgres-tests';
import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

const deflatePromise = promisify(deflate);

describe('FeedFetcherService (Integration)', () => {
  let service: ReturnType<typeof createFeedFetcherService>;
  const url = 'https://rss-feed.com/feed.xml';

  before(async () => {
    await setupPostgresTests();

    service = createFeedFetcherService({
      defaultUserAgent: 'MonitoRSS',
      requestTimeoutMs: 15000,
      objectFileStorage: {} as never,
      cacheStorage: {} as never,
      partitionedRequestsStore: createPartitionedRequestsStore(getTestPool()),
    });
  });

  afterEach(async () => {
    await truncatePartitionedTables();
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

  const seedRequests = async (
    inserts: PartitionedRequestInsert[],
  ): Promise<void> => {
    await createPartitionedRequestsStore(getTestPool()).flushInserts(inserts);
  };

  describe('getLatestRequest', () => {
    it('returns the request with the response', async () => {
      const responseContent = await deflatePromise(
        Buffer.from('feed contents'),
      );

      await seedRequests([
        buildInsert({
          status: RequestStatus.OK,
          response: {
            statusCode: 200,
            textHash: null,
            s3ObjectKey: null,
            redisCacheKey: null,
            headers: {},
            body: {
              hashKey: randomUUID(),
              contents: responseContent.toString('base64'),
            },
          },
        }),
      ]);

      const latestRequest = await service.getLatestRequest({
        url,
        lookupKey: url,
      });

      assert.ok(latestRequest?.request.id);
      assert.partialDeepStrictEqual(latestRequest?.request.response, {
        statusCode: 200,
      });
      assert.strictEqual(latestRequest?.decodedResponseText, 'feed contents');
    });
  });
});
