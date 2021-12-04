import { inject, injectable } from 'inversify';
import { Db, ObjectId } from 'mongodb';
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
export type SupporterOutput = z.output<typeof supporterSchema> & {
  _id: ObjectId
};

@injectable()
export default class SupporterService {
  constructor(
    @inject('MongoDB') private readonly db: Db,
  ) {}

  static COLLECTION_NAME = 'supporters';
  
  async findWithGuild(guildId: string) {
    const supporters = await this.getCollection().find({
      guilds: guildId,
      $or: [
        { expireAt: { $exists: false } },
        // Use Date.now to more easily mock the date in tests
        { expireAt: { $gt: new Date(Date.now()) } },
      ],
    }).toArray();
  
    return supporters as SupporterOutput[];
  }
  
  private getCollection() {
    return this.db.collection(SupporterService.COLLECTION_NAME);
  }
}
