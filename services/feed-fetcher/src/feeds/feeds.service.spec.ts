import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from '../utils/setup-integration-tests';
import { FeedsService } from './feeds.service';
import { Feed, FeedFeature } from './schemas/feed.schema';

describe('FeedsService', () => {
  let service: FeedsService;
  let feedModel: Model<Feed>;

  beforeAll(async () => {
    const { init } = await setupIntegrationTests(
      {
        providers: [FeedsService],
      },
      {
        feedMongoModels: [FeedFeature],
      },
    );

    const { module } = await init();

    service = module.get<FeedsService>(FeedsService);
    feedModel = module.get<Model<Feed>>(getModelToken(Feed.name));
  });

  afterEach(async () => {
    await feedModel.deleteMany({});
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
      await feedModel.insertMany([
        {
          url: 'https://example.com',
        },
        {
          url: 'https://example.com',
        },
      ]);

      await service.disableFeedsByUrl('https://example.com');

      const feeds = await feedModel.find({ url }).lean();

      expect(feeds).toHaveLength(2);
      expect(feeds[0].disabled).toBe(expect.any(String));
      expect(feeds[0].disabledCode).toBe('FAILED_CONNECTION');
      expect(feeds[1].disabled).toBe(expect.any(String));
      expect(feeds[1].disabledCode).toBe('FAILED_CONNECTION');
    });
  });

  describe('enableFailedFeedsByUrl', () => {
    const url = 'https://example.com';

    it('should enable failed feeds by url', async () => {
      await feedModel.insertMany([
        {
          url: 'https://example.com',
          disabled:
            'Failed to establish a successful connection for an extended duration of time',
          disabledCode: 'FAILED_CONNECTION',
        },
        {
          url: 'https://example.com',
          disabled:
            'Failed to establish a successful connection for an extended duration of time',
          disabledCode: 'FAILED_CONNECTION',
        },
      ]);

      await service.enableFailedFeedsByUrl('https://example.com');

      const feeds = await feedModel.find({ url }).lean();

      expect(feeds).toHaveLength(2);
      expect(feeds[0].disabled).toEqual(undefined);
      expect(feeds[1].disabled).toEqual(undefined);
      expect(feeds[0].disabledCode).toEqual(undefined);
      expect(feeds[1].disabledCode).toEqual(undefined);
    });
  });
});
