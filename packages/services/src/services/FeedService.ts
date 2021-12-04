import { inject, injectable } from 'inversify';
import { Db, ObjectId } from 'mongodb';
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

export type FeedInput = z.input<typeof feedSchema>;
export type Feed = z.input<typeof feedSchema> & {
  _id: ObjectId;
};
export type FeedOutput = z.output<typeof feedSchema> & {
  _id: ObjectId
};

@injectable()
export default class FeedService {
  constructor(
    @inject('MongoDB') private readonly db: Db,
  ) {}

  static COLLECTION_NAME = 'feeds';

  async findByGuild(guildId: string): Promise<FeedOutput[]> {
    return this.getCollection().find({ guild: guildId }).sort({
      createdAt: 1,
    }).toArray() as Promise<FeedOutput[]>;
  }

  async find(query: Partial<Feed>, page = 0, limit = 10): Promise<FeedOutput[]> {
    const skip = page * limit;
    const res = await this.getCollection().find(query).limit(limit).skip(skip).sort({
      createdAt: 1,
    }).toArray();

    return res as FeedOutput[];
  }

  async count(query: Partial<Feed>) {
    return this.getCollection().count(query);
  }

  async removeOne(feedId: string) {
    await this.getCollection().deleteOne({ _id: new ObjectId(feedId) });
  }

  async findById(feedId: string): Promise<FeedOutput | null> {
    return this.getCollection().findOne({ _id: new ObjectId(feedId) }) as Promise<FeedOutput>;
  }

  async insertOne(toInsert: FeedInput): Promise<Feed> {
    const inserted = await this.getCollection().insertOne(toInsert);
    
    return {
      ...toInsert,
      _id: inserted.insertedId,
    };
  }

  private getCollection() {
    return this.db.collection(FeedService.COLLECTION_NAME);
  }
}
