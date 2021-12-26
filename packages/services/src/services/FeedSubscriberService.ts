import { inject, injectable } from 'inversify';
import { Db, ObjectId } from 'mongodb';
import { z } from 'zod';

const subscriberSchema = z.object({
  feed: z.instanceof(ObjectId),
  id: z.string(),
  type: z.enum(['user', 'role']),
});

export type FeedSubscriberInput = z.input<typeof subscriberSchema>;
export type FeedSubscriberOutput = z.output<typeof subscriberSchema> & {
  _id: ObjectId;
};


@injectable()
export default class FeedSubscriberService {
  constructor(
    @inject('MongoDB') private readonly db: Db,
  ) {}

  static COLLECTION_NAME = 'subscribers';

  findByUser(userId: string): Promise<FeedSubscriberOutput[]> {
    return this.getCollection()
      .find({ id: userId, type: 'user' }).toArray() as Promise<FeedSubscriberOutput[]>;
  }

  async deleteForUserFeeds(filters: {
    userId: string,
    feedIds: string[]
  }) {
    await this.getCollection().deleteMany({
      id: filters.userId,
      type: 'user',
      feed: {
        $in: filters.feedIds.map(id => new ObjectId(id)),
      },
    });
  }

  async addForUserFeeds(userId: string, feedIds: string[]) {
    await this.getCollection().insertMany(feedIds.map(id => ({
      id: userId,
      type: 'user',
      feed: new ObjectId(id),
    })));
  }

  private getCollection() {
    return this.db.collection(FeedSubscriberService.COLLECTION_NAME);
  }
}
