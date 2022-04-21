import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { TestingModule } from '@nestjs/testing';
import {
  Feed,
  FeedFeature,
  FeedModel,
} from '../features/feeds/entities/feed.entity';
import { FeedsModule } from '../features/feeds/feeds.module';
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from '../utils/integration-tests';
import { MongooseTestModule } from '../utils/mongoose-test.module';

import { Types } from 'mongoose';
import {
  getDefaultFeedUrls,
  getFeedUrlsWithScheduleAndServers,
} from './handle-schedule';

describe('handle-schedule', () => {
  let module: TestingModule;
  let feedModel: FeedModel;

  beforeAll(async () => {
    const { init } = await setupIntegrationTests({
      providers: [FeedsModule],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([FeedFeature]),
      ],
    });

    ({ module } = await init());
    feedModel = module.get<FeedModel>(getModelToken(Feed.name));
  });

  beforeEach(async () => {
    await feedModel.deleteMany();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
    await module.close();
  });

  describe('getFeedUrlsWithScheduleAndServers', () => {
    it('returns matches by schedule keywords', async () => {
      const created = await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id',
          channel: 'channel-id',
        },
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id',
          channel: 'channel-id',
        },
      ]);

      const result = await getFeedUrlsWithScheduleAndServers(
        module,
        [
          {
            name: 'new york times',
            keywords: ['YORK'],
            feeds: [],
            refreshRateMinutes: 10,
          },
        ],
        [],
      );

      expect(result[0]).toEqual(created[0].url);
    });

    it('returns matches on schedule feed ids', async () => {
      const created = await feedModel.insertMany(
        [
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id',
            channel: 'channel-id',
          },
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id',
            channel: 'channel-id',
          },
        ],
        {
          ordered: true,
        },
      );

      const result = await getFeedUrlsWithScheduleAndServers(
        module,
        [
          {
            name: 'new york times',
            keywords: [],
            feeds: [created[1]._id],
            refreshRateMinutes: 10,
          },
        ],
        [],
      );

      expect(result[0]).toEqual(created[1].url);
    });

    it('returns matches on server ids', async () => {
      const created = await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id-1',
          channel: 'channel-id',
        },
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id-2',
          channel: 'channel-id',
        },
      ]);

      const result = await getFeedUrlsWithScheduleAndServers(
        module,
        [
          {
            name: 'new york times',
            keywords: [],
            feeds: [],
            refreshRateMinutes: 10,
          },
        ],
        [created[1].guild],
      );

      expect(result[0]).toEqual(created[1].url);
    });

    it('returns nothing if no results are found', async () => {
      await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id-1',
          channel: 'channel-id',
        },
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id-2',
          channel: 'channel-id',
        },
      ]);

      const result = await getFeedUrlsWithScheduleAndServers(
        module,
        [
          {
            name: 'bloomberg news',
            keywords: ['bloomberg'],
            feeds: [new Types.ObjectId().toString()],
            refreshRateMinutes: 10,
          },
        ],
        ['irrelevant-guild-id'],
      );

      expect(result).toEqual([]);
    });

    it('does not return duplicate urls', async () => {
      const created = await feedModel.create([
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id-1',
          channel: 'channel-id',
        },
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id-2',
          channel: 'channel-id',
        },
      ]);

      const result = await getFeedUrlsWithScheduleAndServers(
        module,
        [
          {
            name: 'new york times',
            keywords: ['yahoo'],
            feeds: [],
            refreshRateMinutes: 10,
          },
        ],
        [created[0].guild],
      );

      expect(result).toEqual([created[0].url]);
    });
  });

  describe('getDefaultFeedUrls', () => {
    it('returns matches by schedule keywords', async () => {
      const created = await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id',
          channel: 'channel-id',
        },
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id',
          channel: 'channel-id',
        },
      ]);

      const result = await getDefaultFeedUrls(
        module,
        [
          {
            name: 'new york times',
            keywords: ['YORK'],
            feeds: [],
            refreshRateMinutes: 10,
          },
        ],
        [],
      );

      expect(result[0]).toEqual(created[1].url);
    });

    it('returns matches on schedule feed ids', async () => {
      const created = await feedModel.insertMany(
        [
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id',
            channel: 'channel-id',
          },
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id',
            channel: 'channel-id',
          },
        ],
        {
          ordered: true,
        },
      );

      const result = await getDefaultFeedUrls(
        module,
        [
          {
            name: 'new york times',
            keywords: [],
            feeds: [created[1]._id],
            refreshRateMinutes: 10,
          },
        ],
        [],
      );

      expect(result[0]).toEqual(created[0].url);
    });

    it('returns matches on server ids', async () => {
      const created = await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id-1',
          channel: 'channel-id',
        },
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id-2',
          channel: 'channel-id',
        },
      ]);

      const result = await getDefaultFeedUrls(
        module,
        [
          {
            name: 'new york times',
            keywords: [],
            feeds: [],
            refreshRateMinutes: 10,
          },
        ],
        [created[1].guild],
      );

      expect(result[0]).toEqual(created[0].url);
    });

    it('returns nothing if no results are found', async () => {
      const created = await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id-1',
          channel: 'channel-id',
        },
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id-2',
          channel: 'channel-id',
        },
      ]);

      const result = await getDefaultFeedUrls(
        module,
        [
          {
            name: 'bloomberg news',
            keywords: ['bloomberg'],
            feeds: [new Types.ObjectId().toString()],
            refreshRateMinutes: 10,
          },
        ],
        ['irrelevant-guild-id'],
      );

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([created[0].url, created[1].url]),
      );
    });

    it('does not return duplicate urls', async () => {
      const created = await feedModel.create([
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id-1',
          channel: 'channel-id',
        },
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id-2',
          channel: 'channel-id',
        },
      ]);

      const result = await getDefaultFeedUrls(module, [], []);

      expect(result).toEqual(expect.arrayContaining([created[0].url]));
    });
  });
});
