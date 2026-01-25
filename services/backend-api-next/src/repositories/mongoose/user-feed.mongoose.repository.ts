import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type { IUserFeed, IUserFeedRepository } from "../interfaces/user-feed.types";
import type { IDiscordChannelConnection, IConnectionDetails } from "../interfaces/feed-connection.types";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../shared/enums";
import { FeedConnectionsSchema, type DiscordChannelConnectionDoc } from "./feed-connection.schemas";
import { BaseMongooseRepository } from "./base.mongoose.repository";

interface ShareInviteConnectionDoc {
  connectionId: Types.ObjectId;
}

interface ShareManageUserDoc {
  id: Types.ObjectId;
  type: string;
  discordUserId: string;
  status: string;
  connections?: ShareInviteConnectionDoc[];
  createdAt: Date;
  updatedAt: Date;
}

const UserFeedUserSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId },
    discordUserId: { type: String, required: true },
  },
  { _id: false, timestamps: false }
);

const UserFeedFormatOptionsSchema = new Schema(
  {
    dateFormat: { type: String },
    dateTimezone: { type: String },
    dateLocale: { type: String },
  },
  { _id: false, timestamps: false }
);

const UserFeedDateCheckOptionsSchema = new Schema(
  {
    oldArticleDateDiffMsThreshold: { type: Number },
  },
  { _id: false, timestamps: false }
);

const ExternalFeedPropertySchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      default: () => new Types.ObjectId().toHexString(),
    },
    sourceField: { type: String, required: true },
    cssSelector: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false, timestamps: false, versionKey: false }
);

const UserFeedShareInviteConnectionSchema = new Schema(
  {
    connectionId: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false, timestamps: false }
);

const UserFeedUserShareManageUserSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, auto: true },
    type: {
      type: String,
      enum: Object.values(UserFeedManagerInviteType),
      default: UserFeedManagerInviteType.CoManage,
    },
    discordUserId: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(UserFeedManagerStatus),
      default: UserFeedManagerStatus.Pending,
    },
    connections: { type: [UserFeedShareInviteConnectionSchema] },
  },
  { _id: false, timestamps: true }
);

const UserFeedShareManageOptionsSchema = new Schema(
  {
    invites: { type: [UserFeedUserShareManageUserSchema], required: true },
  },
  { _id: false, timestamps: false }
);

const UserFeedSchema = new Schema(
  {
    title: { type: String, required: true },
    inputUrl: { type: String },
    url: { type: String, required: true },
    disabledCode: { type: String, enum: Object.values(UserFeedDisabledCode) },
    passingComparisons: { type: [String] },
    blockingComparisons: { type: [String] },
    externalProperties: { type: [ExternalFeedPropertySchema] },
    healthStatus: {
      type: String,
      required: true,
      enum: Object.values(UserFeedHealthStatus),
      default: UserFeedHealthStatus.Ok,
    },
    connections: { type: FeedConnectionsSchema, default: {} },
    user: { type: UserFeedUserSchema, required: true },
    formatOptions: { type: UserFeedFormatOptionsSchema },
    dateCheckOptions: { type: UserFeedDateCheckOptionsSchema },
    shareManageOptions: { type: UserFeedShareManageOptionsSchema },
    legacyFeedId: { type: Schema.Types.ObjectId },
    refreshRateSeconds: { type: Number },
    maxDailyArticles: { type: Number },
    userRefreshRateSeconds: { type: Number },
    slotOffsetMs: { type: Number },
    debug: { type: Boolean },
    feedRequestLookupKey: { type: String },
    lastManualRequestAt: { type: Date },
  },
  { timestamps: true, autoIndex: true }
);

// Indexes
UserFeedSchema.index({ feedRequestLookupKey: 1 }, { unique: true, sparse: true });
UserFeedSchema.index({ feedRequestLookupKey: 1, healthStatus: 1 });
UserFeedSchema.index({ url: 1, healthStatus: 1 });
UserFeedSchema.index({
  feedRequestLookupKey: 1,
  disabledCode: 1,
  "connections.discordChannels.disabledCode": 1,
  url: 1,
});
UserFeedSchema.index({ userRefreshRateSeconds: 1, refreshRateSeconds: 1 });
UserFeedSchema.index({ "user.discordUserId": 1 });
UserFeedSchema.index({ refreshRateSeconds: 1, slotOffsetMs: 1, disabledCode: 1 });
UserFeedSchema.index({
  userRefreshRateSeconds: 1,
  slotOffsetMs: 1,
  disabledCode: 1,
});

type UserFeedDoc = InferSchemaType<typeof UserFeedSchema>;

export class UserFeedMongooseRepository
  extends BaseMongooseRepository<IUserFeed, UserFeedDoc>
  implements IUserFeedRepository
{
  private model: Model<UserFeedDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<UserFeedDoc>("UserFeed", UserFeedSchema);
  }

  private mapDiscordChannelConnection(
    conn: DiscordChannelConnectionDoc
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

  protected toEntity(doc: UserFeedDoc & { _id: Types.ObjectId }): IUserFeed {
    const discordChannels = doc.connections
      .discordChannels as unknown as DiscordChannelConnectionDoc[];

    return {
      id: this.objectIdToString(doc._id),
      title: doc.title,
      inputUrl: doc.inputUrl,
      url: doc.url,
      disabledCode: doc.disabledCode,
      passingComparisons: doc.passingComparisons,
      blockingComparisons: doc.blockingComparisons,
      externalProperties: doc.externalProperties,
      healthStatus: doc.healthStatus,
      connections: {
        discordChannels: discordChannels.map((conn) =>
          this.mapDiscordChannelConnection(conn)
        ),
      },
      user: {
        id: this.objectIdToString(doc.user.id),
        discordUserId: doc.user.discordUserId,
      },
      formatOptions: doc.formatOptions,
      dateCheckOptions: doc.dateCheckOptions,
      shareManageOptions: doc.shareManageOptions
        ? {
            invites: (
              doc.shareManageOptions.invites as unknown as ShareManageUserDoc[]
            ).map((invite) => ({
              id: invite.id.toString(),
              type: invite.type as UserFeedManagerInviteType,
              discordUserId: invite.discordUserId,
              status: invite.status as UserFeedManagerStatus,
              connections: invite.connections?.map((c) => ({
                connectionId: c.connectionId.toString(),
              })),
              createdAt: invite.createdAt,
              updatedAt: invite.updatedAt,
            })),
          }
        : undefined,
      legacyFeedId: this.objectIdToString(doc.legacyFeedId),
      refreshRateSeconds: doc.refreshRateSeconds,
      maxDailyArticles: doc.maxDailyArticles,
      userRefreshRateSeconds: doc.userRefreshRateSeconds,
      slotOffsetMs: doc.slotOffsetMs,
      debug: doc.debug,
      feedRequestLookupKey: doc.feedRequestLookupKey,
      lastManualRequestAt: doc.lastManualRequestAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
