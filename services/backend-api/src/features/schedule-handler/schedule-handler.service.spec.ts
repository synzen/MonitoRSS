import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { TestingModule } from '@nestjs/testing';
import { Feed, FeedFeature, FeedModel } from '../feeds/entities/feed.entity';
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from '../../utils/integration-tests';
import { MongooseTestModule } from '../../utils/mongoose-test.module';

import { Types } from 'mongoose';
import { ScheduleHandlerModule } from './schedule-handler.module';
import { ScheduleHandlerService } from './schedule-handler.service';

describe('handle-schedule', () => {
  let module: TestingModule;
  let feedModel: FeedModel;
  let service: ScheduleHandlerService;

  beforeAll(async () => {
    const { init } = await setupIntegrationTests({
      providers: [],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([FeedFeature]),
        ScheduleHandlerModule,
      ],
    });

    ({ module } = await init());
    feedModel = module.get<FeedModel>(getModelToken(Feed.name));
    service = module.get<ScheduleHandlerService>(ScheduleHandlerService);
  });

  beforeEach(async () => {
    await feedModel.deleteMany();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
    await module?.close();
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

      const result = await service.getFeedUrlsWithScheduleAndServers(
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

    it('does not returns matches by schedule keywords if they are disabled', async () => {
      await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id',
          channel: 'channel-id',
          disabled: 'disabled',
        },
      ]);

      const result = await service.getFeedUrlsWithScheduleAndServers(
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

      expect(result).toEqual([]);
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

      const result = await service.getFeedUrlsWithScheduleAndServers(
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

    it('does not return matches on schedule feed ids if they are disabled', async () => {
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
            disabled: 'disabled-reason',
          },
        ],
        {
          ordered: true,
        },
      );

      const result = await service.getFeedUrlsWithScheduleAndServers(
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

      expect(result).toEqual([]);
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

      const result = await service.getFeedUrlsWithScheduleAndServers(
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

    it('does not return matches on server ids if they are disabled', async () => {
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
          disabled: 'disabled',
        },
      ]);

      const result = await service.getFeedUrlsWithScheduleAndServers(
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

      expect(result).toEqual([]);
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

      const result = await service.getFeedUrlsWithScheduleAndServers(
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

      const result = await service.getFeedUrlsWithScheduleAndServers(
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

      const result = await service.getDefaultFeedUrls(
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

    it('does not return matches by schedule keywords if they are disabled', async () => {
      await feedModel.create([
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
          disabled: 'disabled',
        },
      ]);

      const result = await service.getDefaultFeedUrls(
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

      expect(result).toEqual([]);
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

      const result = await service.getDefaultFeedUrls(
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

    it('does not return matches on schedule feed ids if they are disabled', async () => {
      const created = await feedModel.insertMany(
        [
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id',
            channel: 'channel-id',
            disabled: 'disabled',
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

      const result = await service.getDefaultFeedUrls(
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

      expect(result).toEqual([]);
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

      const result = await service.getDefaultFeedUrls(
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

    it('does not return matches on server ids if they are disabled', async () => {
      const created = await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id-1',
          channel: 'channel-id',
          disabled: 'disabled',
        },
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id-2',
          channel: 'channel-id',
        },
      ]);

      const result = await service.getDefaultFeedUrls(
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

      expect(result).toEqual([]);
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

      const result = await service.getDefaultFeedUrls(
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

      const result = await service.getDefaultFeedUrls([], []);

      expect(result).toEqual(expect.arrayContaining([created[0].url]));
    });
  });
});
