
import { Collection, Db, Document, ObjectId } from 'mongodb';
import { z } from 'zod';

const feedSchema = z.object({
  articleMaxAge: z.number().optional(),
  title: z.string().min(1),
  url: z.string().min(1),
  guild: z.string().min(1),
  channel: z.string().min(1),
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
    })).optional(),
  })).optional(),
  disabled: z.boolean().optional(),
  checkTitles: z.boolean().optional(),
  checkDates: z.boolean().optional(),
  imgPreviews: z.boolean().optional(),
  imgLinksExistence: z.boolean().optional(),
  formatTables: z.boolean().optional(),
  directSubscribers: z.boolean().optional(),
  ncomparisons: z.array(z.string().min(1)).optional(),
  pcomparisons: z.array(z.string().min(1)).optional(),
  regexOps: z.map(z.string().min(1), z.object({
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
  })).optional(),
});

type FeedType = z.infer<typeof feedSchema>;

class FeedRepository {

  static COLLECTION_NAME = 'feeds';

  private readonly collection: Collection<Document>;

  constructor(private readonly mongoDb: Db) {
    this.collection = mongoDb.collection(FeedRepository.COLLECTION_NAME);
  }

  static getRepository(mongoDb: Db) {
    return new FeedRepository(mongoDb);
  }

  async insert(data: FeedType): Promise<void> {
    const parsed = await feedSchema.parseAsync(data);
    await this.collection.insertOne(parsed);
  }

  async update(id: ObjectId, data: Partial<FeedType>): Promise<void> {
    const parsed = await feedSchema.partial().parseAsync(data);
    await this.collection.updateOne({ _id: id }, { $set: parsed });
  }
}

export default FeedRepository;
