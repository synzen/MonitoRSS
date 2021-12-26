import 'reflect-metadata';
import { Collection, Db, Document } from 'mongodb';
import { setupTests, teardownTests } from '../utils/setup-test';
import ScheduleService from './ScheduleService';

describe('ScheduleService', () => {
  let service: ScheduleService;
  let db: Db;
  const collectionName = ScheduleService.COLLECTION_NAME;
  let collection: Collection<Document>;

  beforeAll(async () => {
    db = await setupTests();
    collection = db.collection(collectionName);
    service = new ScheduleService(db);
  });

  beforeEach(async  () => {
    jest.restoreAllMocks();
    await db.dropDatabase();
  });
  
  afterAll(async () => {
    await teardownTests();
  });

  describe('findAll', () => {
    it('returns all the schedules', async () => {
      const toCreate = [{
        name: 'guild1',
        refreshRateMinutes: 2,
        keywords: ['keyword1'],
        feeds: ['feed1'],
      }, {
        name: 'guild2',
        refreshRateMinutes: 3,
        keywords: ['keyword2'],
        feeds: ['feed2'],
      }];
      await collection.insertMany([...toCreate] as any);
      const found = await service.findAll();
      expect(found).toEqual(toCreate);
    });
  });
});
