import { Collection, Db, Document } from 'mongodb';
import { setupTests, teardownTests } from '../utils/testing';
import ProfileRepository from './ProfileRepository';

describe('ProfileRepository', () => {
  let repo: ProfileRepository;
  let db: Db;
  const collectionName = ProfileRepository.COLLECTION_NAME;
  let collection: Collection<Document>;

  beforeAll(async () => {
    db = await setupTests();
    collection = db.collection(collectionName);

    repo = ProfileRepository.getRepository(db);
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
      const found = await repo.findOne(toCreate[1]._id);
      expect(found?.name).toEqual(toCreate[1].name);
    });
  });
});
