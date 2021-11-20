
import { Collection, Db, Document } from 'mongodb';
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
export type ProfileOutput = z.output<typeof profileSchema> & Document;

class ProfileRepository {

  static COLLECTION_NAME = 'profiles';

  private readonly collection: Collection<Document>;

  constructor(private readonly mongoDb: Db) {
    this.collection = mongoDb.collection(ProfileRepository.COLLECTION_NAME);
  }

  static getRepository(mongoDb: Db) {
    return new ProfileRepository(mongoDb);
  }
  
  /**
   * Find a profile given their guild ID.
   *
   * @param guildId The guild ID.
   * @returns The Profile if it exists, otherwise null.
   */
  async findOne(guildId: string): Promise<ProfileOutput | null> {
    const found = await this.collection.findOne({
      _id: guildId,
    });

    return found as ProfileOutput;
  }
}

export default ProfileRepository;
