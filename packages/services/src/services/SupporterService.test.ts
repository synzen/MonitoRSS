import 'reflect-metadata';
import { Collection, Db, Document, ObjectId } from 'mongodb';
import { setupTests, teardownTests } from '../utils/setup-test';
import SupporterService, { SupporterOutput } from './SupporterService';

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

  describe('findByDiscordId', () => {
    it('should return the supporter', async () => {
      const id = '1234';
      const supporter = {
        _id: id,
        name: 'Test',
        guilds: [],
      };

      await collection.insertOne(supporter as any);

      const result = await service.findByDiscordId(id);

      expect(result).toEqual(supporter);
    });
    it('does not return a supporter if their expire date is in the past', async () => {
      const id = '1234';
      const supporter = {
        _id: id,
        name: 'Test',
        guilds: [],
        expireAt: new Date('2020-01-01'),
      };

      await collection.insertOne(supporter as any);

      const result = await service.findByDiscordId(id);

      expect(result).toBeNull();
    });
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
  describe('addGuildToSupporter', () => {
    it('throws if no supporter was found', async () => {
      const supporterId = 'supporter-id';

      await expect(service.addGuildToSupporter(supporterId, 'guildid')).rejects.toThrow();
    });
    it('adds the guild to the supporter', async () => {
      const guildId = 'guildid';
      const supporterId = 'supporter-id';
      const toCreate = [{
        _id: supporterId,
        guilds: ['guildid1', 'guildid2'],
      }];
      await collection.insertMany([...toCreate] as any);

      await service.addGuildToSupporter(supporterId, guildId);

      const found = await collection.findOne({ _id: supporterId as any }) as SupporterOutput;
      expect(found.guilds).toHaveLength(3);
      expect(found.guilds).toContain(guildId);
    });
    it('does not add duplicate guilds to the supporter', async () => {
      const guildId = 'guildid';
      const supporterId = 'supporter-id';
      const toCreate = [{
        _id: supporterId,
        guilds: [guildId],
      }];
      await collection.insertMany([...toCreate] as any);

      await service.addGuildToSupporter(supporterId, guildId);

      const found = await collection.findOne({ _id: supporterId as any }) as SupporterOutput;
      expect(found.guilds).toHaveLength(1);
      expect(found.guilds).toContain(guildId);
    });
  });
  describe('removeGuildFromSupporter', () => {
    it('throws if the supporter is not found', async () => {
      const supporterId = 'supporter-id';

      await expect(service.removeGuildFromSupporter(supporterId, 'guildid')).rejects.toThrow();
    });
    it('removes all instances of the guild from the supporter', async () => {
      const guildId = 'guildid';
      const supporterId = 'supporter-id';
      const toCreate = [{
        _id: supporterId as any,
        guilds: [guildId, guildId],
      }];
      await collection.insertMany([...toCreate]);

      await service.removeGuildFromSupporter(supporterId, guildId);

      const found = await collection.findOne({ _id: supporterId as any }) as SupporterOutput;
      expect(found.guilds).toHaveLength(0);
    });
  });
});
