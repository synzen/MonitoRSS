import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type { IBannedFeed, IBannedFeedRepository } from "../interfaces/banned-feed.types";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const BannedFeedSchema = new Schema(
  {
    url: { type: String, required: true },
    reason: { type: String },
    guildIds: { type: [String], default: [] },
  },
  { collection: "banned_feeds" }
);

type BannedFeedDoc = InferSchemaType<typeof BannedFeedSchema>;

export class BannedFeedMongooseRepository
  extends BaseMongooseRepository<IBannedFeed, BannedFeedDoc>
  implements IBannedFeedRepository
{
  private model: Model<BannedFeedDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<BannedFeedDoc>("BannedFeed", BannedFeedSchema);
  }

  protected toEntity(doc: BannedFeedDoc & { _id: Types.ObjectId }): IBannedFeed {
    return {
      id: this.objectIdToString(doc._id),
      url: doc.url,
      reason: doc.reason,
      guildIds: doc.guildIds,
    };
  }
}
