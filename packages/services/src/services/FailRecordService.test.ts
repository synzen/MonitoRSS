import 'reflect-metadata';
import { Collection, Db, Document } from 'mongodb';
import { setupTests, teardownTests } from '../utils/setup-test';
import FailRecordService from './FailRecordService';
import dayjs from 'dayjs';

describe('FailRecordService', () => {
  let service: FailRecordService;
  let db: Db;
  const collectionName = FailRecordService.COLLECTION_NAME;
  let collection: Collection<Document>;

  beforeAll(async () => {
    db = await setupTests();
    collection = db.collection(collectionName);

    service = new FailRecordService(db);
  });
  beforeEach(async  () => {
    jest.restoreAllMocks();
    await db.dropDatabase();
  });
  
  afterAll(async () => {
    await teardownTests();
  });

  describe('urlIsFailed', () => {
    it('returns false if there is no fail record', async () => {
      const toCreate = [{
        _id: 'https://www.google.com',
        reason: 'reason',
        alerted: false,
      }];
      await collection.insertMany([...toCreate] as any);
      const result = await service.getFailedStatuses(['https://yahoo.com']);
      expect(result).toEqual([false]);
    });
    it('returns false if the fail record is recent', async () => {
      const toCreate = [{
        _id: 'https://www.google.com',
        reason: 'reason',
        alerted: false,
        failedAt: dayjs().subtract(1, 'minute').toDate(),
      }];
      await collection.insertMany([...toCreate] as any);
      const result = await service.getFailedStatuses([toCreate[0]._id]);
      expect(result).toEqual([false]);
    });
    it('returns true if the fail record is old', async () => {
      const toCreate = [{
        _id: 'https://www.google.com',
        reason: 'reason',
        alerted: false,
        failedAt: dayjs().subtract(2, 'hours').toDate(),
      }];
      await collection.insertMany([...toCreate] as any);
      const result = await service.getFailedStatuses([toCreate[0]._id]);
      expect(result).toEqual([true]);
    });
  });

  describe('removeUrls', () => {
    it('removes urls', async () => {
      const toCreate = [{
        _id: 'https://www.google.com',
        reason: 'reason',
        alerted: false,
        failedAt: new Date(),
      }, {
        _id: 'https://www.yahoo.com',
        reason: 'reason',
        alerted: false,
        failedAt: new Date(),
      }, {
        _id: 'https://www.bing.com',
        reason: 'reason',
        alerted: false,
        failedAt: new Date(),
      }];
      await collection.insertMany([...toCreate] as any);
      await service.removeUrls([
        toCreate[0]._id,
        toCreate[2]._id,
      ]);
      const result = await collection.find({}).toArray();
      expect(result).toHaveLength(1);
      expect(result[0]._id).toEqual(toCreate[1]._id);
    });
  });
});
