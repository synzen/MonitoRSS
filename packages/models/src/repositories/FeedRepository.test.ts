import { Collection, Db, Document, ObjectId } from 'mongodb';
import { setupTests, teardownTests } from '../utils/testing';
import FeedRepository from './FeedRepository';

describe('FeedRepository', () => {
  let feedRepo: FeedRepository;
  let db: Db;
  const collectionName = FeedRepository.COLLECTION_NAME;
  let collection: Collection<Document>;

  beforeAll(async () => {
    db = await setupTests();
    collection = db.collection(collectionName);

    feedRepo = FeedRepository.getRepository(db);
  });
  beforeEach(async  () => {
    await db.dropDatabase();
  });
  
  afterAll(async () => {
    await teardownTests();
  });

  describe('insert', () => {
    it('inserts', async () => {
      const toCreate = {
        channel: 'hello',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google.com',
      };

      await feedRepo.insert(toCreate);

      const result = await collection.find().toArray();
      expect(result.length).toBe(1);
      expect(result[0]).toMatchObject(toCreate);
    });
    it('throws if there is an invalid type in input', async () => {
      const toCreate = {
        channel: 'hello',
        guild: 123,
        title: 'hhh',
        url: 'http://www.google.com',
      };

      await expect(feedRepo.insert(toCreate as any)).rejects.toThrowError();
    });
  });

  describe('update', () => {
    const toCreate = Object.freeze({
      channel: 'hello',
      guild: '123',
      title: 'hhh',
      url: 'http://www.google.com',
    });
    let insertedId: ObjectId;

    beforeEach(async () => {
      const inserted = await collection.insertOne({ ...toCreate });
      insertedId = inserted.insertedId;
    });

    it('updates', async () => {
      const update = {
        url: 'http://www.newurl.com',
      };

      await feedRepo.update(insertedId, update);

      const result = await collection.findOne({
        _id: insertedId,
      });
      expect(result).toMatchObject({
        ...toCreate,
        ...update,
      });
    });
  });
});
