import { inject, injectable } from 'inversify';
import { Db, ObjectId } from 'mongodb';
import { z } from 'zod';

const profileSchema = z.object({
  _id: z.string(),
  name: z.string(),
  alert: z.array(z.string()).default([]),
  dateFormat: z.string().optional(),
  dateLanguage: z.string().optional(),
  timezone: z.string().optional(),
  prefix: z.string().optional(),
  locale: z.string().optional(),
});

export type Profile = z.input<typeof profileSchema>;
export type ProfileOutput = z.output<typeof profileSchema> & {
  _id: ObjectId
};


@injectable()
export default class ProfileService {
  constructor(
    @inject('MongoDB') private readonly db: Db,
  ) {}

  static COLLECTION_NAME = 'feeds';

  async findOne(guildId: string) {
    return this.getCollection().findOne({
      _id: guildId as any,
    });
  }

  private getCollection() {
    return this.db.collection(ProfileService.COLLECTION_NAME);
  }
}
