
import { Collection, Db, Document, ObjectId } from 'mongodb';
import { z } from 'zod';

const feedSchema = z.object({
  articleMaxAge: z.number().optional(),
  title: z.string().min(1),
  url: z.string().min(1),
  guild: z.string().min(1),
  channel: z.string().min(1),
  filters: z.record(z.string(), z.array(z.string())).default({}),
  rfilters: z.record(z.string(), z.string()).default({}),
  webhook: z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    avatar: z.string().optional(),
    url: z.string(),
  }).optional(),
  split: z.object({
    enabled: z.boolean(),
    char: z.string().optional(),
    prepend: z.string().optional(),
    append: z.string().optional(),
    maxLength: z.number().optional(),
  }).optional(),
  text: z.string().optional(),
  embeds: z.array(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    url: z.string().optional(),
    color: z.number().max(16777215).optional(),
    footerText: z.string().optional(),
    footerIconURL: z.string().optional(),
    authorName: z.string().optional(),
    authorIconURL: z.string().optional(),
    authorURL: z.string().optional(),
    thumbnailURL: z.string().optional(),
    imageURL: z.string().optional(),
    timestamp: z.enum(['article', 'now']),
    fields: z.array(z.object({
      name: z.string().min(1),
      value: z.string().min(1),
      inline: z.boolean().optional(),
    })).default([]),
  })).default([]),
  disabled: z.boolean().optional(),
  checkTitles: z.boolean().optional(),
  checkDates: z.boolean().optional(),
  imgPreviews: z.boolean().optional(),
  imgLinksExistence: z.boolean().optional(),
  formatTables: z.boolean().optional(),
  directSubscribers: z.boolean().optional(),
  ncomparisons: z.array(z.string().min(1)).default([]),
  pcomparisons: z.array(z.string().min(1)).default([]),
  regexOps: z.record(z.string().min(1), z.object({
    name: z.string().min(1),
    search: z.object({
      regex: z.string().min(1),
      flags: z.string().optional(),
      match: z.number().optional(),
      group: z.number().optional(),
    }),
    fallbackValue: z.string().optional(),
    replacement: z.string().optional(),
    replacementDirect: z.string().optional(),
  })).default({}),
});

export type Feed = z.input<typeof feedSchema>;
export type FeedOutput = z.output<typeof feedSchema> & {
  _id: ObjectId
};

class FeedRepository {

  static COLLECTION_NAME = 'feeds';

  private readonly collection: Collection<Document>;

  constructor(private readonly mongoDb: Db) {
    this.collection = mongoDb.collection(FeedRepository.COLLECTION_NAME);
  }

  static getRepository(mongoDb: Db) {
    return new FeedRepository(mongoDb);
  }

  async insert(data: Feed): Promise<void> {
    const now = new Date();
    const parsed = await feedSchema.parse(data);
    console.log(parsed);
    await this.collection.insertOne({
      ...parsed,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(id: ObjectId, data: Partial<Feed>): Promise<void> {
    const parsed = await feedSchema.partial().parse(data);
    await this.collection.updateOne({ _id: id }, {
      $set: {
        ...parsed,
        updatedAt: new Date(),
      },
    });
  }

  async findByField(key: keyof Feed, value: any): Promise<FeedOutput[]> {
    const res = await this.collection.find({ [key]: value }).sort({
      createdAt: 1,
    }).toArray();

    return res as FeedOutput[];
  }

  async find(query: Partial<Feed>, page = 0, limit = 10): Promise<FeedOutput[]> {
    const skip = page * limit;
    const res = await this.collection.find(query).limit(limit).skip(skip).sort({
      createdAt: 1,
    }).toArray();

    return res as FeedOutput[];
  }

  async count(query: Partial<Feed>): Promise<number> {
    return this.collection.countDocuments(query);
  }

  async countInGuild(guildId: string): Promise<number> {
    return this.collection.countDocuments({ guild: guildId });
  }

  async findById(id: string): Promise<FeedOutput | null> {
    if (!ObjectId.isValid(id)) {
      throw new Error(`Failed to find feed ID ${id} since it is not an ObjectId`);
    }

    const res = await this.collection.findOne({ _id: new ObjectId(id) });

    return res as FeedOutput;
  }

  async removeById(id: string) {
    if (!ObjectId.isValid(id)) {
      throw new Error(`Failed to remove feed ID ${id} since it is not an ObjectId`);
    }

    await this.collection.deleteOne({ _id: new ObjectId(id) });
  }
}

export default FeedRepository;
