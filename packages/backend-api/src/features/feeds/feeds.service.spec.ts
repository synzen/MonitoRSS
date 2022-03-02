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

describe('FeedsService', () => {
  let service: FeedsService;
  let feedModel: FeedModel;
  let failRecordModel: FailRecordModel;

  beforeEach(async () => {
    const { module } = await setupIntegrationTests({
      providers: [FeedsService],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([FeedFeature, FailRecordFeature]),
      ],
    });

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
  });
});
