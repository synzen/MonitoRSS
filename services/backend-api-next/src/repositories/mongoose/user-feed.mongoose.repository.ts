import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
  type PipelineStage,
} from "mongoose";
import type {
  IUserFeed,
  IUserFeedRepository,
  LookupKeyOperation,
  UserFeedForNotification,
  AddConnectionToInviteOperation,
  RemoveConnectionsFromInvitesInput,
  UserFeedBulkWriteOperation,
  UserFeedListingInput,
  UserFeedListItem,
  UserFeedLimitEnforcementResult,
  UserFeedLimitEnforcementQuery,
} from "../interfaces/user-feed.types";
import { UserFeedComputedStatus } from "../interfaces/user-feed.types";
import type {
  IDiscordChannelConnection,
  IConnectionDetails,
} from "../interfaces/feed-connection.types";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
  UserFeedDisabledCode,
  UserFeedHealthStatus,
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../shared/enums";
import {
  FeedConnectionsSchema,
  type DiscordChannelConnectionDoc,
} from "./feed-connection.schemas";
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
  { _id: false, timestamps: false },
);

const UserFeedFormatOptionsSchema = new Schema(
  {
    dateFormat: { type: String },
    dateTimezone: { type: String },
    dateLocale: { type: String },
  },
  { _id: false, timestamps: false },
);

const UserFeedDateCheckOptionsSchema = new Schema(
  {
    oldArticleDateDiffMsThreshold: { type: Number },
  },
  { _id: false, timestamps: false },
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
  { _id: false, timestamps: false, versionKey: false },
);

const UserFeedShareInviteConnectionSchema = new Schema(
  {
    connectionId: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false, timestamps: false },
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
  { _id: false, timestamps: true },
);

const UserFeedShareManageOptionsSchema = new Schema(
  {
    invites: { type: [UserFeedUserShareManageUserSchema], required: true },
  },
  { _id: false, timestamps: false },
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
  { timestamps: true, autoIndex: true },
);

// Indexes
UserFeedSchema.index(
  { feedRequestLookupKey: 1 },
  { unique: true, sparse: true },
);
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
UserFeedSchema.index({
  refreshRateSeconds: 1,
  slotOffsetMs: 1,
  disabledCode: 1,
});
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
          this.mapDiscordChannelConnection(conn),
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

  async bulkUpdateLookupKeys(operations: LookupKeyOperation[]): Promise<void> {
    if (operations.length === 0) {
      return;
    }

    const bulkOps = operations.map((op) => {
      if (op.action === "set") {
        return {
          updateOne: {
            filter: { _id: this.stringToObjectId(op.feedId) },
            update: { $set: { feedRequestLookupKey: op.lookupKey } } as Record<
              string,
              unknown
            >,
          },
        };
      } else {
        return {
          updateOne: {
            filter: { _id: this.stringToObjectId(op.feedId) },
            update: { $unset: { feedRequestLookupKey: 1 } } as Record<
              string,
              unknown
            >,
          },
        };
      }
    });

    await this.model.bulkWrite(
      bulkOps as Parameters<typeof this.model.bulkWrite>[0],
    );
  }

  async findByIdsForNotification(
    ids: string[],
  ): Promise<UserFeedForNotification[]> {
    const objectIds = ids.map((id) => this.stringToObjectId(id));
    const docs = await this.model
      .find({ _id: { $in: objectIds } })
      .select("_id title url user shareManageOptions connections")
      .lean();

    return docs.map((doc) => {
      const docWithId = doc as UserFeedDoc & { _id: Types.ObjectId };
      const discordChannels = docWithId.connections
        .discordChannels as unknown as DiscordChannelConnectionDoc[];

      return {
        id: this.objectIdToString(docWithId._id),
        title: docWithId.title,
        url: docWithId.url,
        user: {
          id: this.objectIdToString(docWithId.user.id),
          discordUserId: docWithId.user.discordUserId,
        },
        shareManageOptions: docWithId.shareManageOptions
          ? {
              invites: (
                docWithId.shareManageOptions
                  .invites as unknown as ShareManageUserDoc[]
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
        connections: {
          discordChannels: discordChannels.map((conn) =>
            this.mapDiscordChannelConnection(conn),
          ),
        },
      };
    });
  }

  async bulkAddConnectionsToInvites(
    operations: AddConnectionToInviteOperation[],
  ): Promise<void> {
    if (operations.length === 0) {
      return;
    }

    const bulkOps = operations.map((op) => ({
      updateOne: {
        filter: {
          _id: this.stringToObjectId(op.feedId),
          "shareManageOptions.invites.discordUserId": op.discordUserId,
        },
        update: {
          $push: {
            "shareManageOptions.invites.$.connections": {
              connectionId: this.stringToObjectId(op.connectionId),
            },
          },
        } as Record<string, unknown>,
      },
    }));

    await this.model.bulkWrite(
      bulkOps as Parameters<typeof this.model.bulkWrite>[0],
    );
  }

  async removeConnectionsFromInvites(
    input: RemoveConnectionsFromInvitesInput,
  ): Promise<void> {
    const { feedId, connectionIds } = input;

    if (connectionIds.length === 0) {
      return;
    }

    const connectionObjectIds = connectionIds.map((id) =>
      this.stringToObjectId(id),
    );

    await this.model.updateOne(
      { _id: this.stringToObjectId(feedId) },
      {
        $pull: {
          "shareManageOptions.invites.$[].connections": {
            connectionId: { $in: connectionObjectIds },
          },
        },
      },
    );
  }

  async create(input: {
    title: string;
    url: string;
    user: { discordUserId: string };
    shareManageOptions?: {
      invites: Array<{
        discordUserId: string;
        status?: string;
        connections?: Array<{ connectionId: string }>;
      }>;
    };
  }): Promise<IUserFeed> {
    const doc = await this.model.create({
      title: input.title,
      url: input.url,
      user: { discordUserId: input.user.discordUserId },
      shareManageOptions: input.shareManageOptions
        ? {
            invites: input.shareManageOptions.invites.map((invite) => ({
              discordUserId: invite.discordUserId,
              status: invite.status,
              connections: invite.connections?.map((c) => ({
                connectionId: this.stringToObjectId(c.connectionId),
              })),
            })),
          }
        : undefined,
    });

    return this.toEntity(
      doc as unknown as UserFeedDoc & { _id: Types.ObjectId },
    );
  }

  async findById(id: string): Promise<IUserFeed | null> {
    const doc = await this.model.findById(this.stringToObjectId(id)).lean();
    if (!doc) {
      return null;
    }
    return this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId });
  }

  private getOwnershipFilter(discordUserId: string) {
    return {
      $or: [
        { "user.discordUserId": discordUserId },
        {
          "shareManageOptions.invites": {
            $elemMatch: {
              discordUserId,
              status: UserFeedManagerStatus.Accepted,
            },
          },
        },
      ],
    };
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private getSearchFilter(search: string) {
    return {
      $or: [
        { title: new RegExp(this.escapeRegExp(search), "i") },
        { url: new RegExp(this.escapeRegExp(search), "i") },
      ],
    };
  }

  private buildListingPipeline(input: UserFeedListingInput): PipelineStage[] {
    const { discordUserId, search, filters } = input;

    const badUserFeedCodes = Object.values(UserFeedDisabledCode).filter(
      (c) => c !== UserFeedDisabledCode.Manual,
    );
    const badConnectionCodes = Object.values(FeedConnectionDisabledCode).filter(
      (c) => c !== FeedConnectionDisabledCode.Manual,
    );
    const feedConnectionTypeKeys = Object.values(FeedConnectionType);

    const pipeline: PipelineStage[] = [
      { $match: this.getOwnershipFilter(discordUserId) },
      {
        $addFields: {
          ownedByUser: { $eq: ["$user.discordUserId", discordUserId] },
          computedStatus: {
            $cond: {
              if: {
                $or: [
                  ...feedConnectionTypeKeys.map((key) => ({
                    $anyElementTrue: {
                      $map: {
                        input: { $ifNull: [`$connections.${key}`, []] },
                        as: "c",
                        in: { $in: [`$$c.disabledCode`, badConnectionCodes] },
                      },
                    },
                  })),
                  { $in: ["$disabledCode", badUserFeedCodes] },
                ],
              },
              then: UserFeedComputedStatus.RequiresAttention,
              else: {
                $cond: {
                  if: { $eq: ["$disabledCode", UserFeedDisabledCode.Manual] },
                  then: UserFeedComputedStatus.ManuallyDisabled,
                  else: {
                    $cond: {
                      if: {
                        $eq: ["$healthStatus", UserFeedHealthStatus.Failing],
                      },
                      then: UserFeedComputedStatus.Retrying,
                      else: UserFeedComputedStatus.Ok,
                    },
                  },
                },
              },
            },
          },
        },
      },
    ];

    const $match: Record<string, unknown> = {};

    if (filters?.ownedByUser !== undefined) {
      $match.ownedByUser = filters.ownedByUser;
    }

    if (filters?.computedStatuses?.length) {
      $match.computedStatus = { $in: filters.computedStatuses };
    }

    if (search) {
      $match.$or = this.getSearchFilter(search).$or;
    }

    if (filters?.disabledCodes) {
      $match.disabledCode = {
        $in: filters.disabledCodes.map((c) => c || null),
      };
    }

    if (Object.keys($match).length) {
      pipeline.push({ $match });
    }

    if (filters?.connectionDisabledCodes) {
      const codesToSearchFor = filters.connectionDisabledCodes.map((c) =>
        c === "" ? null : c,
      );

      const $or: Record<string, unknown>[] = Object.values(
        FeedConnectionType,
      ).map((key) => ({
        [`connections.${key}.disabledCode`]: { $in: codesToSearchFor },
      }));

      if (codesToSearchFor.includes(null)) {
        $or.push({ [`connections.0`]: { $exists: false } });
      }

      pipeline.push({ $match: { $or } } as PipelineStage);
    }

    return pipeline;
  }

  async getUserFeedsListing(
    input: UserFeedListingInput,
  ): Promise<UserFeedListItem[]> {
    const { limit = 10, offset = 0, sort } = input;
    const useSort = sort || "-createdAt";

    const sortSplit = useSort.split("-");
    const sortDirection = useSort.startsWith("-") ? -1 : 1;
    const sortKey = sortSplit[sortSplit.length - 1] as string;

    const pipeline = this.buildListingPipeline(input);

    pipeline.push(
      {
        $addFields: {
          refreshRateSeconds: {
            $ifNull: ["$userRefreshRateSeconds", "$refreshRateSeconds"],
          },
        },
      },
      { $sort: { [sortKey]: sortDirection } },
      { $skip: offset },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          title: 1,
          url: 1,
          inputUrl: 1,
          healthStatus: 1,
          disabledCode: 1,
          createdAt: 1,
          computedStatus: 1,
          legacyFeedId: 1,
          ownedByUser: 1,
          refreshRateSeconds: 1,
        },
      },
    );

    const results = await this.model.aggregate<{
      _id: Types.ObjectId;
      title: string;
      url: string;
      inputUrl?: string;
      healthStatus: string;
      disabledCode?: UserFeedDisabledCode;
      createdAt: Date;
      computedStatus: UserFeedComputedStatus;
      legacyFeedId?: Types.ObjectId;
      ownedByUser: boolean;
      refreshRateSeconds?: number;
    }>(pipeline);

    return results.map((r) => ({
      id: r._id.toString(),
      title: r.title,
      url: r.url,
      inputUrl: r.inputUrl,
      healthStatus: r.healthStatus,
      disabledCode: r.disabledCode,
      createdAt: r.createdAt,
      computedStatus: r.computedStatus,
      legacyFeedId: r.legacyFeedId?.toString(),
      ownedByUser: r.ownedByUser,
      refreshRateSeconds: r.refreshRateSeconds,
    }));
  }

  async getUserFeedsCount(
    input: Omit<UserFeedListingInput, "limit" | "offset" | "sort">,
  ): Promise<number> {
    const pipeline = this.buildListingPipeline(input as UserFeedListingInput);
    pipeline.push({ $count: "count" });

    const results = await this.model.aggregate<{ count: number }>(pipeline);
    return results[0]?.count || 0;
  }

  async countByOwnership(discordUserId: string): Promise<number> {
    return this.model.countDocuments(this.getOwnershipFilter(discordUserId));
  }

  async countByOwnershipExcludingDisabled(
    discordUserId: string,
    excludeDisabledCodes: UserFeedDisabledCode[],
  ): Promise<number> {
    return this.model.countDocuments({
      "user.discordUserId": discordUserId,
      $or: [
        { disabledCode: { $exists: false } },
        { disabledCode: null },
        { disabledCode: { $nin: excludeDisabledCodes } },
      ],
    });
  }

  async findByIdAndOwnership(
    id: string,
    discordUserId: string,
  ): Promise<IUserFeed | null> {
    const doc = await this.model
      .findOne({
        _id: this.stringToObjectId(id),
        ...this.getOwnershipFilter(discordUserId),
      })
      .lean();

    if (!doc) {
      return null;
    }

    return this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId });
  }

  async findByUrls(
    discordUserId: string,
    urls: string[],
  ): Promise<{ url: string }[]> {
    const docs = await this.model
      .find({
        "user.discordUserId": discordUserId,
        url: { $in: urls },
      })
      .select("url")
      .lean();

    return docs.map((doc) => ({ url: doc.url }));
  }

  async updateById(
    id: string,
    update: Record<string, unknown>,
  ): Promise<IUserFeed | null> {
    const doc = await this.model
      .findByIdAndUpdate(this.stringToObjectId(id), update, { new: true })
      .lean();

    if (!doc) {
      return null;
    }

    return this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId });
  }

  async findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: { new?: boolean },
  ): Promise<IUserFeed | null> {
    const doc = await this.model
      .findOneAndUpdate(filter, update, { new: options?.new ?? false })
      .lean();

    if (!doc) {
      return null;
    }

    return this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId });
  }

  async updateWithConnectionFilter(
    feedId: string,
    connectionId: string,
    update: Record<string, unknown>,
  ): Promise<IUserFeed | null> {
    const doc = await this.model
      .findOneAndUpdate(
        {
          _id: this.stringToObjectId(feedId),
          "connections.discordChannels.id": this.stringToObjectId(connectionId),
        },
        update,
        { new: true },
      )
      .lean();

    if (!doc) {
      return null;
    }

    return this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId });
  }

  async countByWebhookId(webhookId: string): Promise<number> {
    return this.model.countDocuments({
      "connections.discordChannels.details.webhook.id": webhookId,
    });
  }

  async findOneByWebhookId(webhookId: string): Promise<IUserFeed | null> {
    const doc = await this.model
      .findOne({
        "connections.discordChannels.details.webhook.id": webhookId,
      })
      .lean();

    if (!doc) {
      return null;
    }

    return this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId });
  }

  async deleteById(id: string): Promise<IUserFeed | null> {
    const doc = await this.model
      .findByIdAndDelete(this.stringToObjectId(id))
      .lean();

    if (!doc) {
      return null;
    }

    return this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId });
  }

  async deleteByIds(ids: string[]): Promise<number> {
    const objectIds = ids.map((id) => this.stringToObjectId(id));
    const result = await this.model.deleteMany({ _id: { $in: objectIds } });
    return result.deletedCount;
  }

  async updateManyByFilter(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<number> {
    const result = await this.model.updateMany(filter, update);
    return result.modifiedCount;
  }

  async findByIds(ids: string[]): Promise<IUserFeed[]> {
    const objectIds = ids.map((id) => this.stringToObjectId(id));
    const docs = await this.model.find({ _id: { $in: objectIds } }).lean();
    return docs.map((doc) =>
      this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId }),
    );
  }

  async *getFeedsGroupedByUserForLimitEnforcement(
    query: UserFeedLimitEnforcementQuery,
  ): AsyncIterable<UserFeedLimitEnforcementResult> {
    const matchFilter =
      query.type === "include"
        ? { "user.discordUserId": { $in: query.discordUserIds } }
        : query.discordUserIds.length > 0
          ? { "user.discordUserId": { $nin: query.discordUserIds } }
          : {};

    if (query.type === "include" && query.discordUserIds.length === 0) {
      return;
    }

    const cursor = this.model
      .aggregate([
        {
          $match: matchFilter,
        },
        {
          $sort: { createdAt: 1 },
        },
        {
          $group: {
            _id: "$user.discordUserId",
            disabledFeedIds: {
              $push: {
                $cond: [
                  {
                    $eq: [
                      "$disabledCode",
                      UserFeedDisabledCode.ExceededFeedLimit,
                    ],
                  },
                  "$_id",
                  "$$REMOVE",
                ],
              },
            },
            enabledFeedIds: {
              $push: {
                $cond: [
                  {
                    $not: [
                      {
                        $in: [
                          "$disabledCode",
                          [
                            UserFeedDisabledCode.ExceededFeedLimit,
                            UserFeedDisabledCode.Manual,
                          ],
                        ],
                      },
                    ],
                  },
                  "$_id",
                  "$$REMOVE",
                ],
              },
            },
          },
        },
      ])
      .cursor();

    for await (const doc of cursor) {
      const result = doc as {
        _id: string;
        disabledFeedIds: Types.ObjectId[];
        enabledFeedIds: Types.ObjectId[];
      };

      yield {
        discordUserId: result._id,
        disabledFeedIds: result.disabledFeedIds.map((id) => id.toString()),
        enabledFeedIds: result.enabledFeedIds.map((id) => id.toString()),
      };
    }
  }

  async bulkWrite(operations: UserFeedBulkWriteOperation[]): Promise<void> {
    if (operations.length === 0) {
      return;
    }
    await this.model.bulkWrite(
      operations as Parameters<typeof this.model.bulkWrite>[0],
    );
  }

  async deleteAll(): Promise<void> {
    await this.model.deleteMany({});
  }

  // Migration methods
  async *iterateFeedsMissingSlotOffset(): AsyncIterable<{
    id: string;
    url: string;
    effectiveRefreshRateSeconds: number;
  }> {
    const cursor = this.model
      .find({ slotOffsetMs: { $exists: false } })
      .select("_id url refreshRateSeconds userRefreshRateSeconds")
      .lean()
      .cursor();

    for await (const doc of cursor) {
      const feedDoc = doc as {
        _id: Types.ObjectId;
        url?: string;
        refreshRateSeconds?: number;
        userRefreshRateSeconds?: number;
      };
      const effectiveRefreshRate =
        feedDoc.userRefreshRateSeconds ?? feedDoc.refreshRateSeconds;

      if (!effectiveRefreshRate || !feedDoc.url) {
        continue;
      }

      yield {
        id: feedDoc._id.toString(),
        url: feedDoc.url,
        effectiveRefreshRateSeconds: effectiveRefreshRate,
      };
    }
  }

  async bulkUpdateSlotOffsets(
    operations: Array<{ feedId: string; slotOffsetMs: number }>,
  ): Promise<void> {
    if (operations.length === 0) {
      return;
    }

    const bulkOps = operations.map(({ feedId, slotOffsetMs }) => ({
      updateOne: {
        filter: { _id: this.stringToObjectId(feedId) },
        update: { $set: { slotOffsetMs } },
      },
    }));

    await this.model.bulkWrite(bulkOps);
  }

  async *iterateFeedsMissingUserId(): AsyncIterable<{
    id: string;
    userDiscordUserId: string;
  }> {
    const cursor = this.model
      .find({ "user.id": { $exists: false } })
      .select("_id user.discordUserId")
      .lean()
      .cursor();

    for await (const doc of cursor) {
      const feedDoc = doc as {
        _id: Types.ObjectId;
        user?: { discordUserId: string };
      };

      if (!feedDoc.user?.discordUserId) {
        continue;
      }

      yield {
        id: feedDoc._id.toString(),
        userDiscordUserId: feedDoc.user.discordUserId,
      };
    }
  }

  async bulkUpdateUserIds(
    operations: Array<{ feedId: string; userId: string }>,
  ): Promise<void> {
    if (operations.length === 0) {
      return;
    }

    const bulkOps = operations.map(({ feedId, userId }) => ({
      updateOne: {
        filter: { _id: this.stringToObjectId(feedId) },
        update: { $set: { "user.id": this.stringToObjectId(userId) } },
      },
    }));

    await this.model.bulkWrite(bulkOps);
  }

  async migrateCustomPlaceholderSteps(
    addIdAndType: (step: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<number> {
    const cursor = this.model
      .find({
        "connections.discordChannels": {
          $elemMatch: {
            customPlaceholders: {
              $elemMatch: {
                id: { $exists: true },
              },
            },
          },
        },
      })
      .cursor();

    let count = 0;
    for await (const doc of cursor) {
      const mongooseDoc = doc as unknown as {
        _id: Types.ObjectId;
        connections: {
          discordChannels: Array<{
            customPlaceholders?: Array<{
              steps: Array<Record<string, unknown>>;
            }>;
          }>;
        };
        get: (path: string) => {
          discordChannels: Array<{
            customPlaceholders?: Array<{
              steps: Array<Record<string, unknown>>;
            }>;
          }>;
        };
        save: () => Promise<unknown>;
      };

      const channels = mongooseDoc.get("connections").discordChannels;
      const updatedChannels = channels.map((channel) => {
        if (!channel.customPlaceholders) {
          return channel;
        }
        return {
          ...channel,
          customPlaceholders: channel.customPlaceholders.map((placeholder) => ({
            ...placeholder,
            steps: placeholder.steps.map(addIdAndType),
          })),
        };
      });

      mongooseDoc.connections.discordChannels = updatedChannels;
      await mongooseDoc.save();
      count++;
    }

    return count;
  }

  async convertStringUserIdsToObjectIds(): Promise<number> {
    const collection = this.model.collection;
    const cursor = collection.find({
      "user.id": { $type: "string" },
    });

    let converted = 0;
    for await (const doc of cursor) {
      const rawDoc = doc as {
        _id: Types.ObjectId;
        user?: { id?: string };
      };

      if (!rawDoc.user?.id || typeof rawDoc.user.id !== "string") {
        continue;
      }

      await collection.updateOne(
        { _id: rawDoc._id },
        { $set: { "user.id": new Types.ObjectId(rawDoc.user.id) } },
      );
      converted++;
    }

    return converted;
  }
}
