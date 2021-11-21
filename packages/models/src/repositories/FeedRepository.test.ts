import dayjs from 'dayjs';
import { Collection, Db, Document, ObjectId } from 'mongodb';
import { setupTests, teardownTests } from '../utils/testing';
import FeedRepository, { Feed } from './FeedRepository';

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
    const toCreate: Feed = {
      channel: 'hello',
      guild: '123',
      title: 'hhh',
      url: 'http://www.google.com',
    } as const;

    it('inserts', async () => {
      await feedRepo.insert({ ...toCreate });

      const result = await collection.find().toArray();
      expect(result.length).toBe(1);
      expect(result[0]).toMatchObject(toCreate);
    });
    it('sets default values for the relevant fields', async () => {
      await feedRepo.insert({ ...toCreate });

      const result = await collection.find().toArray();
      expect(result[0]).toMatchObject({
        filters: {},
        rfilters: {},
        embeds: [],
        ncomparisons: [],
        pcomparisons: [],
        regexOps: {},
      });
    });
    it('throws if there is an invalid type in input', async () => {

      await expect(feedRepo.insert({
        ...toCreate,
        guild: 123,
      } as any))
        .rejects.toThrowError();
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

  describe('find', () => {
    it('returns all the feeds that matches the query', async () => {
      const channel = '123';
      const feedsToCreate: Feed[] = [{
        channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google1.com',
      }, {
        channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google2.com',
      }, {
        channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google3.com',
      }];

      await collection.insertMany(feedsToCreate);

      const result = await feedRepo.find({
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
      const result = await feedRepo.find({
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

      const result = await feedRepo.find({
        channel,
      });
      expect(result).toHaveLength(feedsToCreate.length);
      expect(result[0]).toMatchObject(feedsToCreate[1]);
      expect(result[1]).toMatchObject(feedsToCreate[0]);
      expect(result[2]).toMatchObject(feedsToCreate[2]);
    });
  });

  describe('findByField', () => {
    it('returns all the feeds in a channel', async () => {
      const channel = '123';
      const feedsToCreate: Feed[] = [{
        channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google1.com',
      }, {
        channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google2.com',
      }, {
        channel: channel + 'diff',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google3.com',
      }];

      await collection.insertMany(feedsToCreate);

      const result = await feedRepo.findByField('channel', channel);
      expect(result).toHaveLength(2);
      const urls = result.map(r => r.url);
      expect(urls).toEqual(expect.arrayContaining([
        feedsToCreate[0].url,
        feedsToCreate[1].url,
      ]));
    });
    it('returns all the feeds sorted by ascending created at date', async () => {
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
        channel: channel,
        guild: '123',
        title: 'hhh',
        url: 'http://www.google3.com',
        createdAt: new Date(2040, 1, 1),
      }];

      await collection.insertMany(feedsToCreate);

      const result = await feedRepo.findByField('channel', channel);
      expect(result).toHaveLength(feedsToCreate.length);
      expect(result[0]).toMatchObject(feedsToCreate[1]);
      expect(result[1]).toMatchObject(feedsToCreate[0]);
      expect(result[2]).toMatchObject(feedsToCreate[2]);
    });
  });

  describe('count', () => {
    it('returns correctly', async () => {
      const feedsToCreate: Feed[] = [{
        channel: '123',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google1.com',
      }, {
        channel: '456',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google2.com',
      }, {
        channel: '123',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google3.com',
      }];

      await collection.insertMany(feedsToCreate);

      const result = await feedRepo.count({
        channel: '456',
      });
      expect(result).toBe(1);
    });
  });

  describe('countInGuild', () => {
    it('returns correctly', async () => {
      const guild = '123';
      const feedsToCreate: Feed[] = [{
        channel: '123',
        guild,
        title: 'hhh',
        url: 'http://www.google1.com',
      }, {
        channel: '123',
        guild,
        title: 'hhh',
        url: 'http://www.google2.com',
      }, {
        channel: '123',
        guild: guild + 'new',
        title: 'hhh',
        url: 'http://www.google3.com',
      }];

      await collection.insertMany(feedsToCreate);

      const result = await feedRepo.countInGuild(guild);
      expect(result).toBe(2);
    });
  });

  describe('findById', () => {
    it('finds by id', async () => {
      const feedsToCreate: Feed[] = [{
        channel: '123',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google1.com',
      }, {
        channel: '123',
        guild: '123',
        title: 'hhh',
        url: 'http://www.google2.com',
      }];

      await collection.insertMany(feedsToCreate);
      const created = await collection.find().toArray();
      expect(created).toHaveLength(feedsToCreate.length);
      
      const found = await feedRepo.findById(created[1]._id);
      expect(found).toMatchObject(feedsToCreate[1]);
    });
    it('throws if the id is not a valid ObjectId', async () => {
      const id = '123';
      await expect(feedRepo.findById(id))
        .rejects.toThrowError();
    });
  });

  describe('removeById', () => {
    it('removes by id', async () => {
      const guild = '123';
      const feedsToCreate: Feed[] = [{
        channel: '123',
        guild,
        title: 'hhh',
        url: 'http://www.google1.com',
      }, {
        channel: '123',
        guild,
        title: 'hhh',
        url: 'http://www.google2.com',
      }, {
        channel: '123',
        guild: guild + 'new',
        title: 'hhh',
        url: 'http://www.google3.com',
      }];

      await collection.insertMany(feedsToCreate);
      const found = await collection.find().toArray();
      expect(found).toHaveLength(3);
      
      await feedRepo.removeById(found[0]._id);
      const foundAfter = await collection.find().toArray();
      expect(foundAfter).toHaveLength(2);
    });
    it('throws if the id is not a valid ObjectId', async () => {
      const id = '123';
      await expect(feedRepo.removeById(id))
        .rejects.toThrowError();
    });
  });
});
