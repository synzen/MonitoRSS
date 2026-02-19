import {
  Schema,
  Types,
  type ClientSession,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  ICuratedFeed,
  ICuratedFeedRepository,
} from "../interfaces/curated-feed.types";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const CuratedFeedSchema = new Schema(
  {
    url: { type: String, required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    domain: { type: String, required: true },
    description: { type: String, required: true },
    popular: { type: Boolean },
    disabled: { type: Boolean },
    createdAt: { type: Date },
  },
  { collection: "curated_feeds" },
);

CuratedFeedSchema.index({ url: 1 }, { unique: true });

type CuratedFeedDoc = InferSchemaType<typeof CuratedFeedSchema>;

export class CuratedFeedMongooseRepository
  extends BaseMongooseRepository<ICuratedFeed, CuratedFeedDoc>
  implements ICuratedFeedRepository
{
  private model: Model<CuratedFeedDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<CuratedFeedDoc>(
      "CuratedFeed",
      CuratedFeedSchema,
    );
  }

  protected toEntity(
    doc: CuratedFeedDoc & { _id: Types.ObjectId },
  ): ICuratedFeed {
    return {
      id: this.objectIdToString(doc._id),
      url: doc.url,
      title: doc.title,
      category: doc.category,
      domain: doc.domain,
      description: doc.description,
      popular: doc.popular || undefined,
      disabled: doc.disabled || undefined,
      createdAt: doc.createdAt || undefined,
    };
  }

  async getAll(): Promise<ICuratedFeed[]> {
    const docs = await this.model.find({ disabled: { $ne: true } }).lean();
    return docs.map((doc) =>
      this.toEntity(doc as CuratedFeedDoc & { _id: Types.ObjectId }),
    );
  }

  async replaceAll(
    feeds: Omit<ICuratedFeed, "id">[],
    session?: ClientSession,
  ): Promise<void> {
    await this.model.deleteMany({}, { session });
    if (feeds.length > 0) {
      await this.model.insertMany(feeds, { session });
    }
  }

  async deleteAll(session?: ClientSession): Promise<void> {
    await this.model.deleteMany({}, { session });
  }
}
