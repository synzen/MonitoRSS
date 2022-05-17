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
import {
  FeedSchedule,
  FeedScheduleModel,
} from '../feeds/entities/feed-schedule.entity';

jest.mock('../../utils/logger');

describe('handle-schedule', () => {
  let module: TestingModule;
  let feedModel: FeedModel;
  let feedScheduleModel: FeedScheduleModel;
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
    feedScheduleModel = module.get<FeedScheduleModel>(
      getModelToken(FeedSchedule.name),
    );
    service = module.get<ScheduleHandlerService>(ScheduleHandlerService);
    service.defaultRefreshRateSeconds = 600;
  });

  beforeEach(async () => {
    await feedModel.deleteMany();
    await feedScheduleModel.deleteMany();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
    await module?.close();
  });

  describe('handleRefreshRate', () => {
    it('calls the handlers for feeds with default refresh rate', async () => {
      const createdFeeds = await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id',
          channel: 'channel-id',
          isFeedv2: true,
        },
        {
          title: 'feed-title-2',
          url: 'new-york-times.com',
          guild: 'guild-id-2',
          channel: 'channel-id-2',
          isFeedv2: true,
        },
      ]);

      const urlHandler = jest.fn();
      const feedHandler = jest.fn();

      await service.handleRefreshRate(service.defaultRefreshRateSeconds, {
        urlHandler,
        feedHandler,
      });

      expect(urlHandler).toHaveBeenCalledWith('new-york-times.com');
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[0].title,
        }),
      );
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[1].title,
        }),
      );
    });

    it('calls the handlers for feeds with non-default refresh rates', async () => {
      const createdSchedule = await feedScheduleModel.create({
        name: 'something',
        keywords: ['york'],
        refreshRateMinutes: 4,
      });
      const createdFeeds = await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id',
          channel: 'channel-id',
          isFeedv2: true,
        },
        {
          title: 'feed-title-2',
          url: 'new-york-times.com',
          guild: 'guild-id-2',
          channel: 'channel-id-2',
          isFeedv2: true,
        },
      ]);

      const urlHandler = jest.fn();
      const feedHandler = jest.fn();

      await service.handleRefreshRate(createdSchedule.refreshRateMinutes * 60, {
        urlHandler,
        feedHandler,
      });

      expect(urlHandler).toHaveBeenCalledWith('new-york-times.com');
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[0].title,
        }),
      );
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[1].title,
        }),
      );
    });
  });

  describe('getUrlsMatchingRefreshRate', () => {
    it('does not return duplicate urls for default refresh rate', async () => {
      await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id',
          channel: 'channel-id',
          isFeedv2: true,
        },
        {
          title: 'feed-title-2',
          url: 'new-york-times.com',
          guild: 'guild-id-2',
          channel: 'channel-id-2',
          isFeedv2: true,
        },
      ]);

      const urls = await service.getUrlsMatchingRefreshRate(
        service.defaultRefreshRateSeconds,
      );

      expect(urls).toEqual(['new-york-times.com']);
    });

    it('does not return duplicate urls for default refresh rate', async () => {
      const createdSchedule = await feedScheduleModel.create({
        name: 'something',
        keywords: ['york'],
        refreshRateMinutes: 4,
      });
      await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id',
          channel: 'channel-id',
          isFeedv2: true,
        },
        {
          title: 'feed-title-2',
          url: 'new-york-times.com',
          guild: 'guild-id-2',
          channel: 'channel-id-2',
          isFeedv2: true,
        },
      ]);

      const urls = await service.getUrlsMatchingRefreshRate(
        createdSchedule.refreshRateMinutes * 60,
      );

      expect(urls).toEqual(['new-york-times.com']);
    });
  });

  describe('getFeedsQueryWithScheduleAndServers', () => {
    describe('schedule keywords', () => {
      it('returns matches', async () => {
        const created = await feedModel.create([
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id',
            channel: 'channel-id',
            isFeedv2: true,
          },
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id',
            channel: 'channel-id',
            isFeedv2: true,
          },
        ]);

        const result = await service
          .getFeedsQueryWithScheduleAndServers(
            [
              {
                name: 'new york times',
                keywords: ['YORK'],
                feeds: [],
                refreshRateMinutes: 10,
              },
            ],
            [],
          )
          .lean();

        expect(result[0].url).toEqual(created[0].url);
      });

      it('does not return if they are not v2', async () => {
        await feedModel.create([
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id',
            channel: 'channel-id',
          },
        ]);

        const result = await service
          .getFeedsQueryWithScheduleAndServers(
            [
              {
                name: 'new york times',
                keywords: ['YORK'],
                feeds: [],
                refreshRateMinutes: 10,
              },
            ],
            [],
          )
          .lean();

        expect(result).toEqual([]);
      });

      it('does not return if they are disabled', async () => {
        await feedModel.create([
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id',
            channel: 'channel-id',
            disabled: 'disabled',
            isFeedv2: true,
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndServers(
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
    });

    describe('schedule feed ids', () => {
      it('returns matches', async () => {
        const created = await feedModel.insertMany(
          [
            {
              title: 'feed-title',
              url: 'new-york-times.com',
              guild: 'guild-id',
              channel: 'channel-id',
              isFeedv2: true,
            },
            {
              title: 'feed-title',
              url: 'yahoo-news.com',
              guild: 'guild-id',
              channel: 'channel-id',
              isFeedv2: true,
            },
          ],
          {
            ordered: true,
          },
        );

        const result = await service.getFeedsQueryWithScheduleAndServers(
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

        expect(result[0].url).toEqual(created[1].url);
      });

      it('does not return if they are disabled', async () => {
        const created = await feedModel.insertMany(
          [
            {
              title: 'feed-title',
              url: 'yahoo-news.com',
              guild: 'guild-id',
              channel: 'channel-id',
              disabled: 'disabled-reason',
              isFeedv2: true,
            },
          ],
          {
            ordered: true,
          },
        );

        const result = await service.getFeedsQueryWithScheduleAndServers(
          [
            {
              name: 'new york times',
              keywords: [],
              feeds: [created[0]._id],
              refreshRateMinutes: 10,
            },
          ],
          [],
        );

        expect(result).toEqual([]);
      });

      it('does not return if they are not feed v2', async () => {
        const created = await feedModel.insertMany(
          [
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

        const result = await service.getFeedsQueryWithScheduleAndServers(
          [
            {
              name: 'new york times',
              keywords: [],
              feeds: [created[0]._id],
              refreshRateMinutes: 10,
            },
          ],
          [],
        );

        expect(result).toEqual([]);
      });
    });

    describe('server ids', () => {
      it('returns matches', async () => {
        const created = await feedModel.create([
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id-1',
            channel: 'channel-id',
            isFeedv2: true,
          },
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id-2',
            channel: 'channel-id',
            isFeedv2: true,
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndServers(
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

        expect(result[0].url).toEqual(created[1].url);
      });

      it('does not return if they are disabled', async () => {
        const created = await feedModel.create([
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id-1',
            channel: 'channel-id',
            isFeedv2: true,
          },
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id-2',
            channel: 'channel-id',
            disabled: 'disabled',
            isFeedv2: true,
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndServers(
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

      it('does not return if they are not feed v2', async () => {
        const created = await feedModel.create([
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id-2',
            channel: 'channel-id',
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndServers(
          [
            {
              name: 'new york times',
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[0].guild],
        );

        expect(result).toEqual([]);
      });
    });

    it('returns nothing if no results are found', async () => {
      await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id-1',
          channel: 'channel-id',
          isFeedv2: true,
        },
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id-2',
          channel: 'channel-id',
          isFeedv2: true,
        },
      ]);

      const result = await service.getFeedsQueryWithScheduleAndServers(
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
  });

  describe('getDefaultScheduleFeedQuery', () => {
    describe('schedule keywords', () => {
      it('returns non-matches', async () => {
        const created = await feedModel.create([
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id',
            channel: 'channel-id',
            isFeedv2: true,
          },
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id',
            channel: 'channel-id',
            isFeedv2: true,
          },
        ]);

        const result = await service.getDefaultScheduleFeedQuery(
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

        expect(result[0].url).toEqual(created[1].url);
      });

      it('does not return feeds that are not v2', async () => {
        await feedModel.create([
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id',
            channel: 'channel-id',
          },
        ]);

        const result = await service.getDefaultScheduleFeedQuery(
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

      it('does not return if they are disabled', async () => {
        await feedModel.create([
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id',
            channel: 'channel-id',
            isFeedv2: true,
          },
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id',
            channel: 'channel-id',
            disabled: 'disabled',
            isFeedv2: true,
          },
        ]);

        const result = await service.getDefaultScheduleFeedQuery(
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
    });

    describe('schedule feed ids', () => {
      it('returns non-matches', async () => {
        const created = await feedModel.insertMany(
          [
            {
              title: 'feed-title',
              url: 'new-york-times.com',
              guild: 'guild-id',
              channel: 'channel-id',
              isFeedv2: true,
            },
            {
              title: 'feed-title',
              url: 'yahoo-news.com',
              guild: 'guild-id',
              channel: 'channel-id',
              isFeedv2: true,
            },
          ],
          {
            ordered: true,
          },
        );

        const result = await service.getDefaultScheduleFeedQuery(
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

        expect(result[0].url).toEqual(created[0].url);
      });

      it('does not return if they are disabled', async () => {
        const created = await feedModel.insertMany(
          [
            {
              title: 'feed-title',
              url: 'new-york-times.com',
              guild: 'guild-id',
              channel: 'channel-id',
              disabled: 'disabled',
              isFeedv2: true,
            },
            {
              title: 'feed-title',
              url: 'yahoo-news.com',
              guild: 'guild-id',
              channel: 'channel-id',
              isFeedv2: true,
            },
          ],
          {
            ordered: true,
          },
        );

        const result = await service.getDefaultScheduleFeedQuery(
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

      it('does not return if they are not feed v2', async () => {
        const created = await feedModel.insertMany(
          [
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

        const result = await service.getDefaultScheduleFeedQuery(
          [
            {
              name: 'new york times',
              keywords: [],
              feeds: [created[0]._id],
              refreshRateMinutes: 10,
            },
          ],
          [],
        );

        expect(result).toEqual([]);
      });
    });

    describe('server ids', () => {
      it('returns non-matches', async () => {
        const created = await feedModel.create([
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id-1',
            channel: 'channel-id',
            isFeedv2: true,
          },
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id-2',
            channel: 'channel-id',
            isFeedv2: true,
          },
        ]);

        const result = await service.getDefaultScheduleFeedQuery(
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

        expect(result[0].url).toEqual(created[0].url);
      });

      it('does not return if they are disabled', async () => {
        const created = await feedModel.create([
          {
            title: 'feed-title',
            url: 'new-york-times.com',
            guild: 'guild-id-1',
            channel: 'channel-id',
            disabled: 'disabled',
            isFeedv2: true,
          },
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id-2',
            channel: 'channel-id',
            isFeedv2: true,
          },
        ]);

        const result = await service.getDefaultScheduleFeedQuery(
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

      it('does not return if they are not feed v2', async () => {
        const created = await feedModel.create([
          {
            title: 'feed-title',
            url: 'yahoo-news.com',
            guild: 'guild-id-2',
            channel: 'channel-id',
          },
        ]);

        const result = await service.getDefaultScheduleFeedQuery(
          [
            {
              name: 'new york times',
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[0].guild],
        );

        expect(result).toEqual([]);
      });
    });

    it('returns nothing if no results are found', async () => {
      const created = await feedModel.create([
        {
          title: 'feed-title',
          url: 'new-york-times.com',
          guild: 'guild-id-1',
          channel: 'channel-id',
          isFeedv2: true,
        },
        {
          title: 'feed-title',
          url: 'yahoo-news.com',
          guild: 'guild-id-2',
          channel: 'channel-id',
          isFeedv2: true,
        },
      ]);

      const result = await service.getDefaultScheduleFeedQuery(
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

      const resultUrls = result.map((feed) => feed.url);

      expect(resultUrls).toHaveLength(2);
      expect(resultUrls).toEqual(
        expect.arrayContaining([created[0].url, created[1].url]),
      );
    });
  });
});
