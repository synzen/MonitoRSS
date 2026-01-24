import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  IFeedFilteredFormat,
  IFeedFilteredFormatRepository,
} from "../interfaces";
import { FeedEmbedSchema } from "./feed-embed.schemas";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const FeedFilteredFormatSchema = new Schema(
  {
    text: { type: String },
    embeds: { type: [FeedEmbedSchema] },
    feed: { type: Schema.Types.ObjectId, required: true },
    priority: { type: Number, required: true },
    filters: { type: Map, of: [String] },
  },
  { collection: "filtered_formats" }
);

type FeedFilteredFormatDoc = InferSchemaType<typeof FeedFilteredFormatSchema>;

export class FeedFilteredFormatMongooseRepository
  extends BaseMongooseRepository<IFeedFilteredFormat, FeedFilteredFormatDoc>
  implements IFeedFilteredFormatRepository
{
  private model: Model<FeedFilteredFormatDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<FeedFilteredFormatDoc>(
      "FeedFilteredFormat",
      FeedFilteredFormatSchema
    );
  }

  protected toEntity(
    doc: FeedFilteredFormatDoc & { _id: Types.ObjectId }
  ): IFeedFilteredFormat {
    return {
      id: this.objectIdToString(doc._id),
      text: doc.text,
      embeds: doc.embeds,
      feedId: this.objectIdToString(doc.feed),
      priority: doc.priority,
      filters: doc.filters ? Object.fromEntries(doc.filters) : undefined,
    };
  }
}
