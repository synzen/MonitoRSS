import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  IFeedSubscriber,
  IFeedSubscriberRepository,
} from "../interfaces/feed-subscriber.types";
import { FeedSubscriberType } from "../shared/enums";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const FeedSubscriberSchema = new Schema(
  {
    feed: { type: Schema.Types.ObjectId, required: true, index: true },
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(FeedSubscriberType),
    },
    filters: { type: Map, of: [String] },
    rfilters: { type: Map, of: String },
  },
  { collection: "subscribers", timestamps: true },
);

type FeedSubscriberDoc = InferSchemaType<typeof FeedSubscriberSchema>;

export class FeedSubscriberMongooseRepository
  extends BaseMongooseRepository<IFeedSubscriber, FeedSubscriberDoc>
  implements IFeedSubscriberRepository
{
  private model: Model<FeedSubscriberDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<FeedSubscriberDoc>(
      "FeedSubscriber",
      FeedSubscriberSchema,
    );
  }

  protected toEntity(
    doc: FeedSubscriberDoc & { _id: Types.ObjectId },
  ): IFeedSubscriber {
    return {
      id: this.objectIdToString(doc._id),
      feedId: this.objectIdToString(doc.feed),
      subscriberId: doc.id,
      type: doc.type,
      filters: doc.filters ? Object.fromEntries(doc.filters) : undefined,
      rfilters: doc.rfilters ? Object.fromEntries(doc.rfilters) : undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async findByFeedId(feedId: string): Promise<IFeedSubscriber[]> {
    const docs = await this.model
      .find({ feed: this.stringToObjectId(feedId) })
      .lean();
    return docs.map((doc) =>
      this.toEntity(doc as FeedSubscriberDoc & { _id: Types.ObjectId }),
    );
  }
}
