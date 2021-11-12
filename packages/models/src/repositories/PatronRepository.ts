
import { Collection, Db, Document } from 'mongodb';
import { z } from 'zod';
import dayjs from 'dayjs';

const patronSchema = z.object({
  statusOverride: z.string().optional(),
  status: z.string().optional(),
  lastCharge: z.date().optional(),
  pledgeLifetime: z.number(),
  pledge: z.number(),
  name: z.string().optional(),
  discord: z.string().optional(),
  email: z.string(),
});

export type Patron = z.input<typeof patronSchema>;
export type FeedOutput = z.output<typeof patronSchema>;

class PatronRepository {

  static COLLECTION_NAME = 'patrons';

  private readonly collection: Collection<Document>;

  constructor(private readonly mongoDb: Db) {
    this.collection = mongoDb.collection(PatronRepository.COLLECTION_NAME);
  }

  static getRepository(mongoDb: Db) {
    return new PatronRepository(mongoDb);
  }
  
  static get STATUS() {
    return {
      ACTIVE: 'active_patron',
      FORMER: 'former_patron',
      DECLINED: 'declined_patron',
    };
  }

  /**
   * Find all the patrons who connected their Discord account that has a given user ID. Only
   * includes active patrons and patrons within a 4 day grace period.
   *
   * @param discordId The patron's connected Discord user ID
   * @returns All the patrons who has connected their Discord account with the given ID
   */
  findByDiscordId(discordId: string) {
    return this.collection.find({
      $or: [{
        discord: discordId,
        status: PatronRepository.STATUS.ACTIVE,
        pledge: { $gt: 0 },
      }, {
        status: PatronRepository.STATUS.DECLINED,
        lastCharge: {
          $gte: dayjs().subtract(4, 'days').toDate(),
        },
      }],
    }).toArray();
  }
}

export default PatronRepository;
