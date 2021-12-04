import 'reflect-metadata';
import { Collection, Db, Document } from 'mongodb';
import { setupTests, teardownTests } from '../utils/setup-test';
import ProfileService from './ProfileService';

describe('ProfileService', () => {
  let service: ProfileService;
  let db: Db;
  const collectionName = ProfileService.COLLECTION_NAME;
  let collection: Collection<Document>;

  beforeAll(async () => {
    db = await setupTests();
    collection = db.collection(collectionName);

    service = new ProfileService(db);
  });
  beforeEach(async  () => {
    jest.restoreAllMocks();
    await db.dropDatabase();
  });
  
  afterAll(async () => {
    await teardownTests();
  });

  describe('findOne', () => {
    it('finds all active patrons with that discord ID', async () => {
      const toCreate = [{
        _id: '123',
        name: 'guild1',
        timezone: 'utc',
      }, {
        _id: '456',
        name: 'guild2',
        timezone: 'est',
      }];
      await collection.insertMany([...toCreate] as any);
      const found = await service.findOne(toCreate[1]._id);
      expect(found?.name).toEqual(toCreate[1].name);
    });
  });
});
