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
} from "../interfaces/feed-filtered-format.types";
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
  { collection: "filtered_formats" },
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
      FeedFilteredFormatSchema,
    );
  }

  protected toEntity(
    doc: FeedFilteredFormatDoc & { _id: Types.ObjectId },
  ): IFeedFilteredFormat {
    return {
      id: this.objectIdToString(doc._id),
      text: doc.text ?? undefined,
      embeds: doc.embeds
        ? doc.embeds.map((embed) => ({
            title: embed.title ?? undefined,
            description: embed.description ?? undefined,
            url: embed.url ?? undefined,
            color: embed.color ?? undefined,
            footerText: embed.footerText ?? undefined,
            footerIconURL: embed.footerIconURL ?? undefined,
            authorName: embed.authorName ?? undefined,
            authorIconURL: embed.authorIconURL ?? undefined,
            authorURL: embed.authorURL ?? undefined,
            thumbnailURL: embed.thumbnailURL ?? undefined,
            imageURL: embed.imageURL ?? undefined,
            timestamp: embed.timestamp ?? undefined,
            fields: embed.fields
              ? embed.fields.map((field) => ({
                  name: field.name,
                  value: field.value,
                  inline: field.inline ?? undefined,
                }))
              : undefined,
            webhook: embed.webhook
              ? {
                  id: embed.webhook.id,
                  name: embed.webhook.name ?? undefined,
                  avatar: embed.webhook.avatar ?? undefined,
                  disabled: embed.webhook.disabled ?? undefined,
                  url: embed.webhook.url ?? undefined,
                }
              : undefined,
          }))
        : undefined,
      feedId: this.objectIdToString(doc.feed),
      priority: doc.priority,
      filters: doc.filters ? Object.fromEntries(doc.filters) : undefined,
    };
  }

  async findByFeedId(feedId: string): Promise<IFeedFilteredFormat[]> {
    const docs = await this.model
      .find({ feed: this.stringToObjectId(feedId) })
      .lean();
    return docs.map((doc) =>
      this.toEntity(doc as FeedFilteredFormatDoc & { _id: Types.ObjectId }),
    );
  }
}
