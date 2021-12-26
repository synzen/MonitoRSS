import 'reflect-metadata';
import { Collection, Db, Document, ObjectId } from 'mongodb';
import { setupTests, teardownTests } from '../utils/setup-test';
import FeedSubscriberService from './FeedSubscriberService';

describe('FeedSubscriberService', () => {
  let service: FeedSubscriberService;
  let db: Db;
  const collectionName = FeedSubscriberService.COLLECTION_NAME;
  let collection: Collection<Document>;

  beforeAll(async () => {
    db = await setupTests();
    collection = db.collection(collectionName);

    service = new FeedSubscriberService(db);
  });
  beforeEach(async  () => {
    jest.restoreAllMocks();
    await db.dropDatabase();
  });
  
  afterAll(async () => {
    await teardownTests();
  });

  describe('findByUser', () => {
    it('returns all user subscribers that match the user id', async () => {
      const feedSubscribersToInsert = [
        {
          id: 'user-1',
          type: 'user',
          feed: new ObjectId(),
        },
        {
          id: 'user-1',
          type: 'user',
          feed: new ObjectId(),
        },
      ];
      await collection.insertMany(feedSubscribersToInsert);
      
      const result = await service.findByUser('user-1');

      expect(result).toEqual(feedSubscribersToInsert);
    });
  });

  describe('deleteForUserFeeds', () => {
    it('deletes all user subscribers that match the user id and feed id', async () => {
      const feedSubscribersToInsert = [
        {
          id: 'user-1',
          type: 'user',
          feed: new ObjectId(),
        },
        {
          id: 'user-1',
          type: 'user',
          feed: new ObjectId(),
        },
      ];
      await collection.insertMany(feedSubscribersToInsert);
      
      await service.deleteForUserFeeds({
        userId: 'user-1',
        feedIds: [
          feedSubscribersToInsert[0].feed.toHexString(),
          feedSubscribersToInsert[1].feed.toHexString(),
        ],
      });

      const result = await collection.find({
        id: 'user-1',
        type: 'user',
      }).toArray();

      expect(result).toEqual([]);
    });
  });

  describe('addForUserFeeds', () => {
    it('adds all the feed IDs given the user ID', async () => {
      const userId = 'user-id';
      const feedIds = [
        new ObjectId().toHexString(),
        new ObjectId().toHexString(),
      ];
      await service.addForUserFeeds(userId, feedIds);

      const result = await collection.find({
        id: userId,
        type: 'user',
      }).toArray();

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining(feedIds
          .map(id => expect.objectContaining({
            id: userId,
            type: 'user',
            feed: new ObjectId(id),
          }))),
      );
    });
  });
});
