import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from '../utils/setup-integration-tests';
import { FeedsService } from './feeds.service';
import {
  UserFeed,
  UserFeedDisabledCode,
  UserFeedFeature,
  UserFeedHealthStatus,
} from './schemas/user-feed.schema';

describe('FeedsService', () => {
  let service: FeedsService;
  let userFeedModel: Model<UserFeed>;

  beforeAll(async () => {
    const { init } = await setupIntegrationTests(
      {
        providers: [FeedsService],
      },
      {
        feedMongoModels: [UserFeedFeature],
      },
    );

    const { module } = await init();

    service = module.get<FeedsService>(FeedsService);
    userFeedModel = module.get<Model<UserFeed>>(getModelToken(UserFeed.name));
  });

  afterEach(async () => {
    await userFeedModel.deleteMany({});
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('disableFeedsByUrl', () => {
    const url = 'https://example.com';

    it('should disable feeds by url', async () => {
      await userFeedModel.insertMany([
        {
          url: 'https://example.com',
          healthStatus: UserFeedHealthStatus.Ok,
        },
        {
          url: 'https://example.com',
          healthStatus: UserFeedHealthStatus.Ok,
        },
      ]);

      await service.disableFeedsByUrl('https://example.com');

      const feeds = await userFeedModel.find({ url }).lean();

      expect(feeds).toHaveLength(2);
      expect(feeds[0].disabledCode).toBe(UserFeedDisabledCode.FailedRequests);
      expect(feeds[1].disabledCode).toBe(UserFeedDisabledCode.FailedRequests);
    });
  });

  describe('enableFailedFeedsByUrl', () => {
    const url = 'https://example.com';

    it('should enable failed feeds by url', async () => {
      await userFeedModel.insertMany([
        {
          url: 'https://example.com',
          disabledCode: UserFeedDisabledCode.FailedRequests,
          healthStatus: UserFeedHealthStatus.Ok,
        },
        {
          url: 'https://example.com',
          disabledCode: UserFeedDisabledCode.FailedRequests,
          healthStatus: UserFeedHealthStatus.Ok,
        },
      ]);

      await service.enableFailedFeedsByUrl('https://example.com');

      const feeds = await userFeedModel.find({ url }).lean();

      expect(feeds).toHaveLength(2);
      expect(feeds[0].disabledCode).toEqual(undefined);
      expect(feeds[1].disabledCode).toEqual(undefined);
    });
  });
});
