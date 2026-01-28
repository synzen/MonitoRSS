import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  IBannedFeed,
  IBannedFeedRepository,
} from "../interfaces/banned-feed.types";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const BannedFeedSchema = new Schema(
  {
    url: { type: String, required: true },
    reason: { type: String },
    guildIds: { type: [String], default: [] },
  },
  { collection: "banned_feeds" },
);

type BannedFeedDoc = InferSchemaType<typeof BannedFeedSchema>;

export class BannedFeedMongooseRepository
  extends BaseMongooseRepository<IBannedFeed, BannedFeedDoc>
  implements IBannedFeedRepository
{
  private model: Model<BannedFeedDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<BannedFeedDoc>(
      "BannedFeed",
      BannedFeedSchema,
    );
  }

  protected toEntity(
    doc: BannedFeedDoc & { _id: Types.ObjectId },
  ): IBannedFeed {
    return {
      id: this.objectIdToString(doc._id),
      url: doc.url,
      reason: doc.reason,
      guildIds: doc.guildIds,
    };
  }

  async findByUrlForGuild(
    url: string,
    guildId: string,
  ): Promise<IBannedFeed | null> {
    const doc = await this.model
      .findOne({
        url: url,
        $or: [{ guildIds: guildId }, { guildIds: { $size: 0 } }],
      })
      .lean();

    return doc
      ? this.toEntity(doc as BannedFeedDoc & { _id: Types.ObjectId })
      : null;
  }

  async create(input: Omit<IBannedFeed, "id">): Promise<IBannedFeed> {
    const doc = await this.model.create(input);
    return this.toEntity(doc.toObject());
  }

  async deleteAll(): Promise<void> {
    await this.model.deleteMany({});
  }
}
