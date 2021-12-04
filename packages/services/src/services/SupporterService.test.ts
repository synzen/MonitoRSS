import 'reflect-metadata';
import { Collection, Db, Document } from 'mongodb';
import { setupTests, teardownTests } from '../utils/setup-test';
import SupporterService from './SupporterService';

describe('SupporterService', () => {
  let service: SupporterService;
  let db: Db;
  const collectionName = SupporterService.COLLECTION_NAME;
  let collection: Collection<Document>;

  beforeAll(async () => {
    db = await setupTests();
    collection = db.collection(collectionName);

    service = new SupporterService(db);
  });
  beforeEach(async  () => {
    jest.restoreAllMocks();
    await db.dropDatabase();
  });
  
  afterAll(async () => {
    await teardownTests();
  });

  describe('findWithGuild', () => {
    it('finds all supporters who has added this guild', async () => {
      const toCreate = [{
        guilds: ['guildid1', 'guildid2'],
      }, {
        guilds: ['guildid3', 'guildid4'],
      }];
      const inserted = await collection.insertMany([...toCreate]);
      const inserted0Id = inserted.insertedIds[0];

      const found = await service.findWithGuild(toCreate[0].guilds[0]);
      expect(found).toHaveLength(1);
      expect(found[0]._id).toEqual(inserted0Id);
    });
    it('does not return expired guilds', async () => {
      const guilds = ['guildid1', 'guildid2'];
      const toCreate = [{
        guilds,
        expireAt: new Date(2030, 1, 1),
      }, {
        guilds,
        expireAt: new Date(2010, 1, 1),
      }];

      jest.spyOn(Date, 'now').mockImplementation(() => new Date(2020, 1, 1).getTime());
      const inserted = await collection.insertMany([...toCreate]);
      const inserted0Id = inserted.insertedIds[0];

      const found = await service.findWithGuild(toCreate[0].guilds[0]);
      expect(found).toHaveLength(1);
      expect(found[0]._id).toEqual(inserted0Id);
    });
  });
});
