import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { createTestFeed } from '../../test/data/feeds.test-data';
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from '../../utils/integration-tests';
import { MongooseTestModule } from '../../utils/mongoose-test.module';
import { Feed, FeedFeature, FeedModel } from './entities/Feed.entity';
import { FeedsService } from './feeds.service';
import { Types } from 'mongoose';
import {
  FailRecord,
  FailRecordFeature,
  FailRecordModel,
} from './entities/fail-record.entity';
import { createTestFailRecord } from '../../test/data/failrecords.test-data';
import { FeedStatus } from './types/FeedStatus.type';

describe('FeedsService', () => {
  let service: FeedsService;
  let feedModel: FeedModel;
  let failRecordModel: FailRecordModel;

  beforeEach(async () => {
    const { init } = await setupIntegrationTests({
      providers: [FeedsService],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([FeedFeature, FailRecordFeature]),
      ],
    });

    const { module } = await init();

    service = module.get<FeedsService>(FeedsService);
    feedModel = module.get<FeedModel>(getModelToken(Feed.name));
    failRecordModel = module.get<FailRecordModel>(
      getModelToken(FailRecord.name),
    );
  });

  afterEach(async () => {
    await teardownIntegrationTests();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFeed', () => {
    it('returns null if no feed is found', async () => {
      const result = await service.getFeed('5e6b5f0f7b1c8a1f7b3a0a1b');

      expect(result).toBeNull();
    });

    it('returns the feed if it is found', async () => {
      const createdFeed = await feedModel.create(createTestFeed());

      const result = await service.getFeed(createdFeed._id.toString());

      expect(result).toEqual(
        expect.objectContaining({
          _id: createdFeed._id,
          refreshRateSeconds: expect.any(Number),
        }),
      );
    });
  });

  describe('getServerFeeds', () => {
    it('returns the sorted feeds, respecting limit and offset', async () => {
      const guild = 'server-1';
      const feedsToInsert = await Promise.all([
        createTestFeed({
          addedAt: new Date(2020),
          title: '2020',
          guild,
        }),
        createTestFeed({
          addedAt: new Date(2019),
          title: '2019',
          guild,
        }),
        createTestFeed({
          addedAt: new Date(2022),
          title: '2022',
          guild,
        }),
        createTestFeed({
          addedAt: new Date(2021),
          title: '2021',
          guild,
        }),
      ]);

      await feedModel.insertMany(feedsToInsert);

      const found = await service.getServerFeeds(guild, {
        limit: 2,
        offset: 1,
      });

      const foundTitles = found.map((feed) => feed.title);

      expect(foundTitles).toEqual(['2021', '2020']);
    });
  });

  describe('countServerFeeds', () => {
    it('returns the correct count', async () => {
      const guild = 'server-1';
      const feedsToInsert = await Promise.all([
        createTestFeed({
          title: '2020',
          guild,
        }),
        createTestFeed({
          title: '2019',
          guild,
        }),
      ]);

      await feedModel.insertMany(feedsToInsert);

      const count = await service.countServerFeeds(guild);

      expect(count).toEqual(2);
    });
  });

  describe('updateOne', () => {
    it('throws if no feed is found', async () => {
      await expect(
        service.updateOne(new Types.ObjectId(), {
          text: 'hello',
        }),
      ).rejects.toThrowError();
    });

    it('updates the text', async () => {
      const newText = 'my-new-text';
      const createdFeed = await feedModel.create(
        createTestFeed({
          text: 'old-text',
        }),
      );

      await service.updateOne(createdFeed._id.toString(), {
        text: newText,
      });

      const updatedFeed = await feedModel.findById(createdFeed._id).lean();

      expect(updatedFeed).toEqual(expect.objectContaining({ text: newText }));
    });

    it('does not update the text if undefined is passed', async () => {
      const createdFeed = await feedModel.create(
        createTestFeed({
          text: 'old-text',
        }),
      );

      await service.updateOne(createdFeed._id.toString(), {
        text: undefined,
      });

      const updatedFeed = await feedModel.findById(createdFeed._id).lean();

      expect(updatedFeed).toEqual(
        expect.objectContaining({ text: createdFeed.text }),
      );
    });

    it('returns the updated feed', async () => {
      const newText = 'new-text';
      const createdFeed = await feedModel.create(
        createTestFeed({
          text: 'old-text',
        }),
      );

      const result = await service.updateOne(createdFeed._id.toString(), {
        text: newText,
      });

      expect(result).toEqual(
        expect.objectContaining({
          _id: createdFeed._id,
          text: newText,
        }),
      );
    });
  });

  describe('refresh', () => {
    it('throws if the feed does not exist', async () => {
      const id = new Types.ObjectId();
      await expect(service.refresh(id)).rejects.toThrowError();
    });

    it('deletes the fail record', async () => {
      const createdFeed = await feedModel.create(createTestFeed());
      const createdRecord = await failRecordModel.create({
        _id: createdFeed.url,
        reason: 'reason',
        alerted: true,
        failedAt: new Date(2020, 1, 1),
      });

      await service.refresh(createdFeed._id.toString());

      const updatedFeed = await failRecordModel
        .findById(createdRecord._id)
        .lean();

      expect(updatedFeed).toBeNull();
    });

    it('returns status ok', async () => {
      const createdFeed = await feedModel.create(createTestFeed());
      const result = await service.refresh(createdFeed._id.toString());

      expect(result.status).toEqual(FeedStatus.OK);
    });
  });

  describe('findFeeds', () => {
    const defaultOptions = {
      skip: 0,
      limit: 1000,
    };

    it('does not return feeds that do not match filters', async () => {
      const feedUrl = 'https://example.com/feed';
      const feeds = await feedModel.create([
        createTestFeed({
          url: feedUrl,
        }),
        createTestFeed({
          url: feedUrl + '1',
        }),
      ]);
      const result = await service.findFeeds(
        {
          url: feeds[0].url,
        },
        defaultOptions,
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toEqual(feeds[0].url);
    });

    it('respects skip and limit', async () => {
      const feeds = await feedModel.create(
        createTestFeed({
          url: '2020',
          addedAt: new Date(2020, 1, 1),
        }),
        createTestFeed({
          url: '2019',
          addedAt: new Date(2019, 1, 1),
        }),
        createTestFeed({
          url: '2021',
          addedAt: new Date(2021, 1, 1),
        }),
      );
      const result = await service.findFeeds(
        {},
        {
          skip: 1,
          limit: 1,
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toEqual(feeds[0].url);
    });

    it('returns feed status failed correctly', async () => {
      const createdFeed = await feedModel.create(createTestFeed());
      const faiLRecordsToInsert = [
        createTestFailRecord({
          _id: createdFeed.url,
          failedAt: new Date(1990, 1, 1),
        }),
      ];
      await failRecordModel.insertMany(faiLRecordsToInsert);
      const result = await service.findFeeds(
        {
          _id: createdFeed._id,
        },
        defaultOptions,
      );

      expect(result[0]).toEqual(
        expect.objectContaining({
          status: FeedStatus.FAILED,
        }),
      );
    });
    it('returns feed status OK correctly', async () => {
      const createdFeed = await feedModel.create(createTestFeed());
      const result = await service.findFeeds(
        {
          _id: createdFeed._id,
        },
        defaultOptions,
      );

      expect(result[0]).toEqual(
        expect.objectContaining({
          status: FeedStatus.OK,
        }),
      );
    });

    it('returns refresh rates', async () => {
      const createdFeed = await feedModel.create(createTestFeed());
      const result = await service.findFeeds(
        {
          _id: createdFeed._id,
        },
        defaultOptions,
      );

      expect(result[0]).toEqual(
        expect.objectContaining({
          refreshRateSeconds: expect.any(Number),
        }),
      );
    });

    it('does not return failed status for fail records within the past 18 hours', async () => {
      const createdFeed = await feedModel.create(createTestFeed());

      const failRecordDate = new Date();
      failRecordDate.setHours(failRecordDate.getHours() - 2);
      const faiLRecordsToInsert = [
        createTestFailRecord({
          _id: createdFeed.url,
          failedAt: failRecordDate,
        }),
      ];
      await failRecordModel.insertMany(faiLRecordsToInsert);
      const result = await service.findFeeds(
        {
          _id: createdFeed._id,
        },
        defaultOptions,
      );

      expect(result[0].status).toEqual(FeedStatus.OK);
    });
  });
});
