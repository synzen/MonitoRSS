import 'reflect-metadata';
import dayjs from 'dayjs';
import { Collection, Db, Document } from 'mongodb';
import { setupTests, teardownTests } from '../utils/setup-test';
import PatronService from './PatronService';

describe('PatronService', () => {
  let repo: PatronService;
  let db: Db;
  const collectionName = PatronService.COLLECTION_NAME;
  let collection: Collection<Document>;

  beforeAll(async () => {
    db = await setupTests();
    collection = db.collection(collectionName);

    repo = new PatronService(db);
  });
  beforeEach(async  () => {
    jest.restoreAllMocks();
    await db.dropDatabase();
  });
  
  afterAll(async () => {
    await teardownTests();
  });

  describe('findByDiscordId', () => {
    it('finds all active patrons with that discord ID', async () => {
      const discord = '1234';
      const toCreate = [{
        discord,
        status: PatronService.STATUS.ACTIVE,
        pledge: 500,
      }, {
        discord,
        status: PatronService.STATUS.ACTIVE,
        pledge: 100,
      }];
      await collection.insertMany([...toCreate]);
      const found = await repo.findByDiscordId(discord);
      expect(found).toHaveLength(2);
    });

    it('finds declined patrons within the 4 day grace period', async () => {
      const discord = '1234';
      const toCreate = [{
        discord,
        status: PatronService.STATUS.DECLINED,
        pledge: 0,
        lastCharge: dayjs().subtract(10, 'day').toDate(),
      }, {
        discord,
        status: PatronService.STATUS.DECLINED,
        pledge: 0,
        lastCharge: dayjs().subtract(3, 'day').toDate(),
      }];
      const { insertedIds } = await collection.insertMany([...toCreate]);
      
      const found = await repo.findByDiscordId(discord);
      expect(found).toHaveLength(1);
      expect(found[0]._id).toEqual(insertedIds[1]);
    });
  });
});
