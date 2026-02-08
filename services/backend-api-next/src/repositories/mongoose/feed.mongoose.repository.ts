import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type {
  IFeed,
  IFeedRepository,
  IFeedWithFailRecord,
} from "../interfaces/feed.types";
import type {
  IDiscordChannelConnection,
  IConnectionDetails,
} from "../interfaces/feed-connection.types";
import { FeedEmbedSchema, FeedWebhookSchema } from "./feed-embed.schemas";
import {
  FeedConnectionsSchema,
  type DiscordChannelConnectionDoc,
} from "./feed-connection.schemas";
import { BaseMongooseRepository } from "./base.mongoose.repository";

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FeedRegexOpSearchSchema = new Schema(
  {
    regex: { type: String, required: true },
    flags: { type: String },
    match: { type: Number },
    group: { type: Number },
  },
  { _id: false },
);

const FeedRegexOpSchema = new Schema(
  {
    name: { type: String, required: true },
    search: { type: FeedRegexOpSearchSchema, required: true },
    fallbackValue: { type: String },
    replacement: { type: String },
    replacementDirect: { type: String },
  },
  { _id: false },
);

const FeedSplitOptionsSchema = new Schema(
  {
    enabled: { type: Boolean },
    char: { type: Boolean },
    prepend: { type: Boolean },
    append: { type: Boolean },
    maxLength: { type: Boolean },
  },
  { _id: false },
);

const FeedSchema = new Schema(
  {
    text: { type: String },
    title: { type: String, required: true },
    url: { type: String, required: true },
    guild: { type: String, required: true },
    channel: { type: String, required: true },
    filters: { type: Map, of: [String] },
    rfilters: { type: Map, of: String },
    embeds: { type: [FeedEmbedSchema], default: [] },
    disabled: { type: String },
    checkTitles: { type: Boolean },
    checkDates: { type: Boolean },
    imgPreviews: { type: Boolean },
    imgLinksExistence: { type: Boolean },
    formatTables: { type: Boolean },
    directSubscribers: { type: Boolean },
    ncomparisons: { type: [String], default: [] },
    pcomparisons: { type: [String], default: [] },
    webhook: { type: FeedWebhookSchema },
    addedAt: { type: Date, default: Date.now },
    split: { type: FeedSplitOptionsSchema },
    regexOps: { type: Map, of: [FeedRegexOpSchema] },
    isFeedv2: { type: Boolean },
    connections: { type: FeedConnectionsSchema, default: {} },
  },
  { collection: "feeds", timestamps: true },
);

type FeedDoc = InferSchemaType<typeof FeedSchema>;

export class FeedMongooseRepository
  extends BaseMongooseRepository<IFeed, FeedDoc>
  implements IFeedRepository
{
  private model: Model<FeedDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<FeedDoc>("Feed", FeedSchema);
  }

  private mapDiscordChannelConnection(
    conn: DiscordChannelConnectionDoc,
  ): IDiscordChannelConnection {
    return {
      id: conn.id.toString(),
      name: conn.name,
      disabledCode: conn.disabledCode,
      disabledDetail: conn.disabledDetail,
      filters: conn.filters,
      rateLimits: conn.rateLimits,
      mentions: conn.mentions,
      details: conn.details as unknown as IConnectionDetails,
      splitOptions: conn.splitOptions,
      customPlaceholders: conn.customPlaceholders,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    } as IDiscordChannelConnection;
  }

  protected toEntity(doc: FeedDoc & { _id: Types.ObjectId }): IFeed {
    const discordChannels = doc.connections?.discordChannels as unknown as
      | DiscordChannelConnectionDoc[]
      | undefined;

    return {
      id: this.objectIdToString(doc._id),
      text: doc.text,
      title: doc.title,
      url: doc.url,
      guild: doc.guild,
      channel: doc.channel,
      filters: doc.filters ? Object.fromEntries(doc.filters) : undefined,
      rfilters: doc.rfilters ? Object.fromEntries(doc.rfilters) : undefined,
      embeds: doc.embeds,
      disabled: doc.disabled,
      checkTitles: doc.checkTitles,
      checkDates: doc.checkDates,
      imgPreviews: doc.imgPreviews,
      imgLinksExistence: doc.imgLinksExistence,
      formatTables: doc.formatTables,
      directSubscribers: doc.directSubscribers,
      ncomparisons: doc.ncomparisons,
      pcomparisons: doc.pcomparisons,
      webhook: doc.webhook,
      addedAt: doc.addedAt,
      split: doc.split,
      regexOps: doc.regexOps ? Object.fromEntries(doc.regexOps) : undefined,
      isFeedv2: doc.isFeedv2,
      connections: discordChannels
        ? {
            discordChannels: discordChannels.map((conn) =>
              this.mapDiscordChannelConnection(conn),
            ),
          }
        : undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async aggregateWithFailRecords(options: {
    guildId: string;
    search?: string;
    skip: number;
    limit: number;
  }): Promise<IFeedWithFailRecord[]> {
    const match: Record<string, unknown> = {
      guild: options.guildId,
    };

    if (options.search) {
      match.$or = [
        { title: new RegExp(escapeRegExp(options.search), "i") },
        { url: new RegExp(escapeRegExp(options.search), "i") },
      ];
    }

    const feeds = await this.model.aggregate([
      { $match: match },
      { $sort: { addedAt: -1 } },
      { $skip: options.skip },
      { $limit: options.limit },
      {
        $lookup: {
          from: "fail_records",
          localField: "url",
          foreignField: "_id",
          as: "failRecord",
        },
      },
      {
        $addFields: {
          failRecord: { $first: "$failRecord" },
        },
      },
    ]);

    return feeds.map((doc) => {
      const feed = this.toEntity(doc) as IFeedWithFailRecord;

      if (doc.failRecord) {
        feed.failRecord = {
          id: doc.failRecord._id?.toString() || doc.failRecord._id,
          reason: doc.failRecord.reason,
          failedAt: doc.failRecord.failedAt,
          alerted: doc.failRecord.alerted,
        };
      }

      return feed;
    });
  }

  async countByGuild(guildId: string, search?: string): Promise<number> {
    const query: Record<string, unknown> = {
      guild: guildId,
    };

    if (search) {
      query.$or = [
        { title: new RegExp(escapeRegExp(search), "i") },
        { url: new RegExp(escapeRegExp(search), "i") },
      ];
    }

    return this.model.countDocuments(query);
  }

  async create(input: {
    title: string;
    url: string;
    guild: string;
    channel: string;
    addedAt?: Date;
  }): Promise<IFeed> {
    const doc = await this.model.create({
      ...input,
      embeds: [],
      addedAt: input.addedAt ?? new Date(),
    });
    return this.toEntity(doc.toObject());
  }

  async deleteAll(): Promise<void> {
    await this.model.deleteMany({});
  }

  async findById(id: string): Promise<IFeed | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toEntity(doc as FeedDoc & { _id: Types.ObjectId }) : null;
  }

  async updateById(
    id: string,
    update: Record<string, unknown>,
  ): Promise<IFeed | null> {
    const doc = await this.model
      .findByIdAndUpdate(id, update, { new: true })
      .lean();
    return doc ? this.toEntity(doc as FeedDoc & { _id: Types.ObjectId }) : null;
  }

  async findUnconvertedByGuilds(options: {
    guildIds: string[] | "*";
    conversionDisabledCodes: string[];
  }): Promise<IFeed[]> {
    const query: Record<string, unknown> = {
      disabled: {
        $nin: options.conversionDisabledCodes,
      },
    };

    if (options.guildIds !== "*") {
      query.guild = { $in: options.guildIds };
    }

    const docs = await this.model.find(query).lean();
    return docs.map((doc) =>
      this.toEntity(doc as FeedDoc & { _id: Types.ObjectId }),
    );
  }
}
