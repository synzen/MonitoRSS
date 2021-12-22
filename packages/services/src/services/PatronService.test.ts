import 'reflect-metadata';
import dayjs from 'dayjs';
import { Collection, Db, Document } from 'mongodb';
import { setupTests, teardownTests } from '../utils/setup-test';
import PatronService from './PatronService';

describe('PatronService', () => {
  let service: PatronService;
  let db: Db;
  const collectionName = PatronService.COLLECTION_NAME;
  let collection: Collection<Document>;
  let config = {
    defaultMaxFeeds: 10,
  };

  beforeAll(async () => {
    db = await setupTests();
    collection = db.collection(collectionName);

    service = new PatronService(db, config as any);
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
      const found = await service.findByDiscordId(discord);
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
      
      const found = await service.findByDiscordId(discord);
      expect(found).toHaveLength(1);
      expect(found[0]._id).toEqual(insertedIds[1]);
    });
    it('returns an empty array if no matching patrons for the discord id are found', async () => {
      const discord = '1234';
      const found = await service.findByDiscordId(discord);
      expect(found).toHaveLength(0);
    });
  });

  describe('getGuildLimitFromDiscordId', () => {
    it('returns 1 if no patron was found', async () => {
      const discord = '1234';
      const found = await service.getGuildLimitFromDiscordId(discord);
      expect(found).toEqual(1);
    });
    it('returns 4 if total pledge lifetime is >= 2500', async () => {
      const discord = '1234';
      const toCreate = [{
        discord,
        status: PatronService.STATUS.ACTIVE,
        pledge: 500,
        pledgeLifetime: 2000,
      }, {
        discord,
        status: PatronService.STATUS.ACTIVE,
        pledge: 100,
        pledgeLifetime: 500,
      }];
      await collection.insertMany([...toCreate]);
      const found = await service.getGuildLimitFromDiscordId(discord);
      expect(found).toEqual(4);
    });
    it('returns 3 if total pledge lifetime is >= 1500', async () => {
      const discord = '1234';
      const toCreate = [{
        discord,
        status: PatronService.STATUS.ACTIVE,
        pledge: 500,
        pledgeLifetime: 1500,
      }, {
        discord,
        status: PatronService.STATUS.ACTIVE,
        pledge: 100,
        pledgeLifetime: 500,
      }];
      await collection.insertMany([...toCreate]);
      const found = await service.getGuildLimitFromDiscordId(discord);
      expect(found).toEqual(3);
    });
    it('returns 2 if total pledge lifetime is >= 500', async () => {
      const discord = '1234';
      const toCreate = [{
        discord,
        status: PatronService.STATUS.ACTIVE,
        pledge: 500,
        pledgeLifetime: 500,
      }, {
        discord,
        status: PatronService.STATUS.ACTIVE,
        pledge: 100,
        pledgeLifetime: 500,
      }];
      await collection.insertMany([...toCreate]);
      const found = await service.getGuildLimitFromDiscordId(discord);
      expect(found).toEqual(2);
    });
    it('returns 1 if total pledge lifetime is < 500', async () => {
      const discord = '1234';
      const toCreate = [{
        discord,
        status: PatronService.STATUS.ACTIVE,
        pledge: 500,
        pledgeLifetime: 100,
      }, {
        discord,
        status: PatronService.STATUS.ACTIVE,
        pledge: 100,
        pledgeLifetime: 100,
      }];
      await collection.insertMany([...toCreate]);
      const found = await service.getGuildLimitFromDiscordId(discord);
      expect(found).toEqual(1);
    });
  });
  
  describe('getFeedLimitFromPatronPledge', () => {
    it('returns 140 for >= 2000 for pledge', function () {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      expect(service['getFeedLimitFromPatronPledge'](2100)).toEqual(140);
    });
    it('returns 70 for >= 1000 for pledge', function () {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      expect(service['getFeedLimitFromPatronPledge'](1100)).toEqual(70);
    });
    it('returns 35 for >= 500 for pledge', function () {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      expect(service['getFeedLimitFromPatronPledge'](500)).toEqual(35);
    });
    it('returns 15 for >= 250 for pledge', function () {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      expect(service['getFeedLimitFromPatronPledge'](250)).toEqual(15);
    });
    it('returns default for < 250 for pledge', function () {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      expect(service['getFeedLimitFromPatronPledge'](100)).toEqual(config.defaultMaxFeeds);
    });
  });
});
