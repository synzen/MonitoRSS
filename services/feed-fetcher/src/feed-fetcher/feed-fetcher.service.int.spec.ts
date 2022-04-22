import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SqsPollingService } from '../shared/services/sqs-polling.service';
import setupPostgresTests from '../shared/utils/setup-postgres-tests';
import { RequestStatus } from './constants';
import { Request, Response } from './entities';
import { FeedFetcherService } from './feed-fetcher.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

jest.mock('../utils/logger');

describe('FeedFetcherService (Integration)', () => {
  const databaseName = 'feedfetcherserviceintegrationtest';
  let teardownDatabase: () => Promise<any>;
  let resetDatabase: () => Promise<any>;
  let app: INestApplication;
  let service: FeedFetcherService;
  const url = 'https://rss-feed.com/feed.xml';

  beforeAll(async () => {
    const setupData = await setupPostgresTests({
      databaseName,
      moduleMetadata: {
        providers: [FeedFetcherService, ConfigService, SqsPollingService],
        imports: [
          TypeOrmModule.forFeature([Request, Response]),
          EventEmitterModule.forRoot(),
        ],
      },
    });

    teardownDatabase = setupData.teardownDatabase;
    resetDatabase = setupData.resetDatabase;

    setupData.uncompiledModule.overrideProvider(ConfigService).useValue({
      get: jest.fn(),
    });

    const { module } = await setupData.setupDatabase();

    app = module.createNestApplication();
    await app.init();

    service = app.get(FeedFetcherService);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('getEarliestFailedAttempt', () => {
    it('returns the earliest failed attempt if there were no previous ok attempts', async () => {
      const requestRepo = app.get<Repository<Request>>(
        getRepositoryToken(Request),
      );
      const inserted = await requestRepo.insert([
        {
          status: RequestStatus.FAILED,
          url,
          createdAt: new Date(2020, 1, 6),
        },
        {
          status: RequestStatus.FAILED,
          url,
          createdAt: new Date(2020, 1, 5),
        },
        {
          status: RequestStatus.FAILED,
          url,
          createdAt: new Date(2020, 1, 4),
        },
        {
          status: RequestStatus.FAILED,
          url: 'fake-url',
          createdAt: new Date(2020, 1, 1),
        },
      ]);

      const earliestFailedAttempt = await service.getEarliestFailedAttempt(url);

      expect(earliestFailedAttempt?.id).toEqual(inserted.identifiers[2].id);
    });
    it('returns the first failed attempt after the latest success', async () => {
      const requestRepo = app.get<Repository<Request>>(
        getRepositoryToken(Request),
      );

      const irrelevantUrl = 'https://irrelevant.com/feed.xml';

      const inserted = await requestRepo.insert([
        {
          status: RequestStatus.FAILED,
          url,
          createdAt: new Date(2020, 1, 6),
        },
        {
          status: RequestStatus.FAILED,
          url,
          createdAt: new Date(2020, 1, 5),
        },
        {
          status: RequestStatus.FAILED,
          url,
          createdAt: new Date(2020, 1, 4),
        },
        {
          status: RequestStatus.FAILED,
          url: irrelevantUrl,
          createdAt: new Date(2020, 1, 4),
        },
        {
          status: RequestStatus.OK,
          url,
          createdAt: new Date(2020, 1, 3),
        },
        {
          status: RequestStatus.OK,
          url: irrelevantUrl,
          createdAt: new Date(2020, 1, 5),
        },
      ]);

      const foundAttempt = await service.getEarliestFailedAttempt(url);

      expect(foundAttempt?.id).toEqual(inserted.identifiers[2].id);
    });
  });

  afterAll(async () => {
    await teardownDatabase();
  });
});
