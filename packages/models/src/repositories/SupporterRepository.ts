
import { Collection, Db, Document } from 'mongodb';
import { z } from 'zod';

const supporterSchema = z.object({
  patron: z.boolean().optional(),
  webhook: z.boolean().optional(),
  maxGuilds: z.number().optional(),
  maxFeeds: z.number().optional(),
  guilds: z.array(z.string()).default([]),
  expireAt: z.date().optional(),
  comment: z.string().optional(),
  slowRate: z.boolean().optional(),
});

export type Supporter = z.input<typeof supporterSchema>;
export type SupporterOutput = z.output<typeof supporterSchema> & Document;

class SupporterRepository {

  static COLLECTION_NAME = 'supporters';

  private readonly collection: Collection<Document>;

  constructor(private readonly mongoDb: Db) {
    this.collection = mongoDb.collection(SupporterRepository.COLLECTION_NAME);
  }

  static getRepository(mongoDb: Db) {
    return new SupporterRepository(mongoDb);
  }

  /**
   * Find all the supporters who has connected a guild to their account. Excludes expired
   * supporters.
   * 
   * @param guildId The guild ID.
   * @returns All the supporters who is currently backing this guild.
   */
  async findWithGuild(guildId: string): Promise<SupporterOutput[]> {
    const supporters = await this.collection.find({
      guilds: guildId,
      $or: [
        { expireAt: { $exists: false } },
        // Use Date.now to more easily mock the date in tests
        { expireAt: { $gt: new Date(Date.now()) } },
      ],
    }).toArray();

    return supporters as SupporterOutput[];
  }
}

export default SupporterRepository;
