import 'reflect-metadata';
import { Collection, Db, Document, ObjectId } from 'mongodb';
import { setupTests, teardownTests } from '../utils/setup-test';
import FeedService, { Feed } from './FeedService';
import dayjs from 'dayjs';

describe('FeedService', () => {
  let service: FeedService;
  let db: Db;
  let collection: Collection<Document>;

  beforeAll(async () => {
    db = await setupTests();
    collection = db.collection(FeedService.COLLECTION_NAME);
  });
  beforeEach(async () => {
    jest.resetAllMocks();
    service = new FeedService( db);
  });
  afterEach(async () => {
    await db.dropDatabase();
    
  });
  afterAll(async () => {
    await teardownTests();
  });

  describe('findByGuild', () => {
    it('returns all the feeds in a channel', async () => {
      const feedsToCreate: Feed[] = [{
        _id: new ObjectId(),
        channel: '123',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google1.com',
      }, {
        channel: '123',
        _id: new ObjectId(),
        guild: '123',
        title: 'hhh',
        url: 'http://www.google2.com',
      }, {
        channel: '123',
        _id: new ObjectId(),
        guild: '12345',
        title: 'hhh',
        url: 'http://www.google3.com',
      }];

      await collection.insertMany(feedsToCreate);

      const result = await service.findByGuild('123');
      expect(result).toHaveLength(2);
      const urls = result.map(r => r.url);
      expect(urls).toEqual(expect.arrayContaining([
        feedsToCreate[0].url,
        feedsToCreate[1].url,
      ]));
    });
    it('returns all the feeds sorted by ascending created at date', async () => {
      const feedsToCreate = [{
        channel: '123',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google1.com',
        createdAt: new Date(2030, 1, 2),
      }, {
        channel: '123',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google2.com',
        createdAt: new Date(2020, 1, 1),
      }, {
        channel: '123',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google3.com',
        createdAt: new Date(2040, 1, 1),
      }];

      await collection.insertMany(feedsToCreate);

      const result = await service.findByGuild('123');
      expect(result).toHaveLength(feedsToCreate.length);
      expect(result[0]).toMatchObject(feedsToCreate[1]);
      expect(result[1]).toMatchObject(feedsToCreate[0]);
      expect(result[2]).toMatchObject(feedsToCreate[2]);
    });
  });

  describe('find', () => {
    it('returns all the feeds that matches the query', async () => {
      const channel = '123';
      const feedsToCreate: Feed[] = [{
        _id: new ObjectId(),
        channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google1.com',
      }, {
        _id: new ObjectId(),
        channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google2.com',
      }, {
        _id: new ObjectId(),
        channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google3.com',
      }];

      await collection.insertMany(feedsToCreate);

      const result = await service.find({
        channel,
        url: feedsToCreate[0].url,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject(feedsToCreate[0]);
    });

    it('works with pagination', async () => {
      const feedsToCreate: Feed[] = new Array(5).fill(0).map((_, i) => {
        const createdAt = dayjs().add(i, 'day').toDate();
        
        return {
          _id: new ObjectId(),
          channel: 'channel-id',
          guild: `${i}`,
          title: 'hhh',
          url: 'http://www.google.com',
          createdAt,
        };
      });

      
      await collection.insertMany(feedsToCreate);
      const page = 1;
      const limit = 2;
      const result = await service.find({
        channel: 'channel-id',
        url: feedsToCreate[0].url,
      }, page, limit);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject(feedsToCreate[2]);
      expect(result[1]).toMatchObject(feedsToCreate[3]);
    });
    it('returns the results sorted by created at ascending', async () => {
      const channel = '123';
      const feedsToCreate = [{
        channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google1.com',
        createdAt: new Date(2030, 1, 2),
      }, {
        channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google2.com',
        createdAt: new Date(2020, 1, 1),
      }, {
        channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google3.com',
        createdAt: new Date(2040, 1, 1),
      }];

      await collection.insertMany(feedsToCreate);

      const result = await service.find({
        channel,
      });
      expect(result).toHaveLength(feedsToCreate.length);
      expect(result[0]).toMatchObject(feedsToCreate[1]);
      expect(result[1]).toMatchObject(feedsToCreate[0]);
      expect(result[2]).toMatchObject(feedsToCreate[2]);
    });
  });

  describe('count', () => {
    it('returns correctly', async () => {
      const feedsToCreate: Feed[] = [{
        _id: new ObjectId(),
        channel: '123',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google1.com',
      }, {
        _id: new ObjectId(),
        channel: '456',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google2.com',
      }, {
        _id: new ObjectId(),
        channel: '123',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google3.com',
      }];

      await collection.insertMany(feedsToCreate);

      const result = await service.count({
        channel: '456',
      });
      expect(result).toBe(1);
    });
  });

  describe('findById', () => {
    it('returns the found feed', async () => {
      const feed = {
        _id: new ObjectId(),
        guildId: '1',
        channelId: '1',
      };
      await collection.insertOne(feed);
      const result = await service.findById(feed._id.toHexString());
      expect(result).toMatchObject(feed);
    });
  });
  
  describe('removeById', () => {
    it('removes by id', async () => {
      const guild = '123';
      const feedsToCreate: Feed[] = [{
        _id: new ObjectId(),
        channel: '123',
        guild,
        title: 'hhh',
        url: 'http://www.google1.com',
      }, {
        _id: new ObjectId(),
        channel: '123',
        guild,
        title: 'hhh',
        url: 'http://www.google2.com',
      }, {
        _id: new ObjectId(),
        channel: '123',
        guild: guild + 'new',
        title: 'hhh',
        url: 'http://www.google3.com',
      }];

      await collection.insertMany(feedsToCreate);
      const found = await collection.find().toArray();
      expect(found).toHaveLength(3);
      
      await service.removeOne(found[0]._id.toHexString());
      const foundAfter = await collection.find().toArray();
      expect(foundAfter).toHaveLength(2);
    });
  });

  describe('insert', () => {
    it('inserts one', async () => {
      const toInsert = {
        channel: 'channel-id',
        guild: 'guild-id',
        title: 'title',
        url: 'http://www.google.com',
      };
      await service.insertOne(toInsert);

      const found = await collection.find().toArray();
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject(toInsert);
    });
    it('returns the created feed with the id', async () => {
      const toInsert = {
        channel: 'channel-id',
        guild: 'guild-id',
        title: 'title',
        url: 'http://www.google.com',
      };
      const result = await service.insertOne(toInsert);

      expect(result).toMatchObject({
        ...toInsert, 
        _id: expect.any(ObjectId),
      });
    });
  });
});
