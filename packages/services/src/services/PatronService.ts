import { inject, injectable } from 'inversify';
import { Db, ObjectId } from 'mongodb';
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
export type PatronOutput = z.output<typeof patronSchema> & {
  _id: ObjectId;
};


@injectable()
export default class PatronService {
  constructor(
    @inject('MongoDB') private readonly db: Db,
  ) {}

  static COLLECTION_NAME = 'patrons';
  
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
  async findByDiscordId(discordId: string): Promise<PatronOutput[]> {
    const found = await this.getCollection().find({
      $or: [{
        discord: discordId,
        status: PatronService.STATUS.ACTIVE,
        pledge: { $gt: 0 },
      }, {
        status: PatronService.STATUS.DECLINED,
        lastCharge: {
          $gte: dayjs().subtract(4, 'days').toDate(),
        },
      }],
    }).toArray();

    return found as PatronOutput[];
  }
  
  private getCollection() {
    return this.db.collection(PatronService.COLLECTION_NAME);
  }
}
