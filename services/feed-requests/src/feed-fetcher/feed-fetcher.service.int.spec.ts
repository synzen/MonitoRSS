/* eslint-disable max-len */
import { INestApplication } from '@nestjs/common';
import { RequestStatus } from './constants';
import { FeedFetcherService } from './feed-fetcher.service';
import {
  clearDatabase,
  setupPostgresTests,
  teardownPostgresTests,
} from '../shared/utils/setup-postgres-tests';
import { Request, Response } from './entities';
import { EntityRepository } from '@mikro-orm/postgresql';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { ObjectFileStorageService } from '../object-file-storage/object-file-storage.service';
import { CacheStorageService } from '../cache-storage/cache-storage.service';
import { FastifyAdapter } from '@nestjs/platform-fastify';

jest.mock('../utils/logger');

describe('FeedFetcherService (Integration)', () => {
  let app: INestApplication;
  let service: FeedFetcherService;
  const url = 'https://rss-feed.com/feed.xml';
  let requestRepo: EntityRepository<Request>;

  beforeAll(async () => {
    const setupData = await setupPostgresTests(
      {
        providers: [
          FeedFetcherService,
          {
            provide: ObjectFileStorageService,
            useValue: {
              getFeedHtmlContent: jest.fn(),
              uploadFeedHtmlContent: jest.fn(),
            },
          },
          {
            provide: CacheStorageService,
            useValue: {
              getFeedHtmlContent: jest.fn(),
              setFeedHtmlContent: jest.fn(),
            },
          },
        ],
      },
      {
        models: [Request, Response],
      },
    );

    const { module } = await setupData.init();

    app = module.createNestApplication(new FastifyAdapter());
    await app.init();

    service = app.get(FeedFetcherService);
    requestRepo = app.get<EntityRepository<Request>>(
      getRepositoryToken(Request),
    );
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownPostgresTests();
  });

  describe('getRequests', () => {
    it('returns correctly according to input params', async () => {
      const req = new Request();
      req.url = url;
      req.status = RequestStatus.OK;
      req.createdAt = new Date(2020);
      const re2 = new Request();
      re2.url = url;
      re2.status = RequestStatus.BAD_STATUS_CODE;
      re2.createdAt = new Date(2021);
      const re3 = new Request();
      re3.url = url;
      re3.status = RequestStatus.BAD_STATUS_CODE;
      re3.createdAt = new Date(2022);

      await requestRepo.persistAndFlush([req, re2, re3]);

      const result = await service.getRequests({
        skip: 1,
        limit: 1,
        url,
        select: ['id', 'status'],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: re2.id,
        status: re2.status,
      });
    });

    it('returns an empty array if nothing matches', async () => {
      const result = await service.getRequests({
        skip: 0,
        limit: 10,
        url,
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('getLatestRequest', () => {
    it('returns the request with the response', async () => {
      const req1 = new Request();
      req1.status = RequestStatus.BAD_STATUS_CODE;
      req1.url = url;
      req1.createdAt = new Date(2020, 1, 6);

      const response = new Response();
      response.statusCode = 200;
      response.isCloudflare = false;

      req1.response = response;

      await requestRepo.persistAndFlush([req1]);

      const latestRequest = await service.getLatestRequest({
        url,
        lookupKey: url,
      });

      expect(latestRequest?.request.id).toEqual(req1.id);
      expect(latestRequest?.request.response).toMatchObject({
        statusCode: 200,
        isCloudflare: false,
      });
    });
  });
});
