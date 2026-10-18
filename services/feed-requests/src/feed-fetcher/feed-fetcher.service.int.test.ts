import { MikroORM } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import dayjs from 'dayjs';
import { deflate } from 'zlib';
import { promisify } from 'util';
import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert';
import { RequestStatus } from './constants';
import { RequestSource } from './constants/request-source.constants';
import { FeedFetcherService } from './feed-fetcher.service';
// eslint-disable-next-line max-len -- prettier cannot break this import
import PartitionedRequestsStoreService from '../partitioned-requests-store/partitioned-requests-store.service';
// eslint-disable-next-line max-len -- prettier cannot break this import
import { PartitionedRequestInsert } from '../partitioned-requests-store/types/partitioned-request.type';
import {
  recreatePartitionedTables,
  setupPostgresTests,
  teardownPostgresTests,
} from '../shared/utils/setup-postgres-tests';
import { silenceLogger } from '../test/helpers/silence-logger';

silenceLogger();

const deflatePromise = promisify(deflate);

describe('FeedFetcherService (Integration)', () => {
  let service: FeedFetcherService;
  let orm: MikroORM;
  const url = 'https://rss-feed.com/feed.xml';

  before(async () => {
    orm = await setupPostgresTests();

    service = new FeedFetcherService(
      { getOrThrow: () => 'MonitoRSS' } as never,
      {} as never,
      {} as never,
      new PartitionedRequestsStoreService(orm),
    );
    service.defaultUserAgent = 'MonitoRSS';
    service.feedRequestTimeoutMs = 15000;
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

  const seedRequests = async (
    inserts: PartitionedRequestInsert[],
  ): Promise<void> => {
    await new PartitionedRequestsStoreService(orm).flushInserts(inserts);
  };

  describe('getRequests', () => {
    it('returns correctly according to input params', async () => {
      await seedRequests([
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

      const result = await service.getRequests({
        skip: 1,
        limit: 1,
        url,
      });

      assert.strictEqual(result.length, 1);
      assert.partialDeepStrictEqual(result[0], {
        status: RequestStatus.BAD_STATUS_CODE,
        url,
      });
    });

    it('returns an empty array if nothing matches', async () => {
      const result = await service.getRequests({
        skip: 0,
        limit: 10,
        url,
      });

      assert.strictEqual(result.length, 0);
    });
  });

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
