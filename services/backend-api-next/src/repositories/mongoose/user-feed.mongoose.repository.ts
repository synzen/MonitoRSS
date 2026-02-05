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
  UserFeedListingInput,
  UserFeedListItem,
  UserFeedLimitEnforcementResult,
  UserFeedLimitEnforcementQuery,
  WebhookEnforcementTarget,
  RefreshRateEnforcementTarget,
  CloneConnectionToFeedsInput,
  CloneConnectionToFeedsResult,
  CreateUserFeedInput,
  CloneUserFeedInput,
  UserFeedWithConnections,
  CopySettingsToFeedsInput,
  CopySettingsTarget,
  UserFeedForBulkOperation,
  AddInviteToFeedInput,
  UpdateInviteRepoInput,
  UserFeedForPendingInvites,
  ScheduledFeedWithLookupKey,
  FeedForSlotOffsetRecalculation,
  RefreshRateSyncInput,
  MaxDailyArticlesSyncInput,
  UserFeedForDelivery,
} from "../interfaces/user-feed.types";
import type { SlotWindow } from "../../shared/types/slot-window.types";
import { getCommonFeedAggregateStages } from "../../shared/utils/get-common-feed-aggregate-stages";
import { calculateSlotOffsetMs } from "../../shared/utils/fnv1a-hash";
import { getEffectiveRefreshRateSeconds } from "../../shared/utils/get-effective-refresh-rate";
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

export { UserFeedSchema };
export type UserFeedModel = Model<UserFeedDoc>;

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
      .select("_id title url user shareManageOptions")
      .lean();

    return docs.map((doc) => {
      const docWithId = doc as UserFeedDoc & { _id: Types.ObjectId };

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

  async create(input: CreateUserFeedInput): Promise<IUserFeed> {
    const doc = await this.model.create({
      title: input.title,
      url: input.url,
      inputUrl: input.inputUrl,
      connections: input.connections,
      createdAt: input.createdAt,
      feedRequestLookupKey: input.feedRequestLookupKey,
      slotOffsetMs: input.slotOffsetMs,
      user: {
        id: new Types.ObjectId(input.user.id),
        discordUserId: input.user.discordUserId,
      },
      refreshRateSeconds: input.refreshRateSeconds,
      maxDailyArticles: input.maxDailyArticles,
      dateCheckOptions: input.dateCheckOptions,
      shareManageOptions: input.shareManageOptions
        ? {
            invites: input.shareManageOptions.invites.map((invite) => ({
              discordUserId: invite.discordUserId,
              type: invite.type,
              status: invite.status,
              connections: invite.connections?.map((c) => ({
                connectionId: this.stringToObjectId(c.connectionId),
              })),
            })),
          }
        : undefined,
      passingComparisons: input.passingComparisons,
      blockingComparisons: input.blockingComparisons,
      externalProperties: input.externalProperties,
      formatOptions: input.formatOptions,
      userRefreshRateSeconds: input.userRefreshRateSeconds,
    });

    return this.toEntity(
      doc as unknown as UserFeedDoc & { _id: Types.ObjectId },
    );
  }

  async clone(input: CloneUserFeedInput): Promise<IUserFeed> {
    const { sourceFeed, overrides } = input;

    const {
      id,
      connections,
      createdAt,
      updatedAt,
      feedRequestLookupKey,
      slotOffsetMs,
      ...cloneableFields
    } = sourceFeed;

    const url = overrides.url;
    const effectiveRefreshRate =
      getEffectiveRefreshRateSeconds(cloneableFields);

    const doc = await this.model.create({
      ...cloneableFields,
      title: overrides.title || cloneableFields.title,
      url,
      inputUrl: overrides.inputUrl,
      connections: { discordChannels: [] },
      slotOffsetMs: effectiveRefreshRate
        ? calculateSlotOffsetMs(url, effectiveRefreshRate)
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

  async filterFeedIdsByOwnership(
    feedIds: string[],
    discordUserId: string,
  ): Promise<string[]> {
    const objectIds = feedIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (objectIds.length === 0) return [];

    const docs = await this.model
      .find({
        _id: { $in: objectIds },
        ...this.getOwnershipFilter(discordUserId),
      })
      .select("_id")
      .lean();

    return docs.map((doc) => (doc._id as Types.ObjectId).toString());
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

  areAllValidIds(ids: string[]): boolean {
    return ids.every((id) => Types.ObjectId.isValid(id));
  }

  async countByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const objectIds = ids.map((id) => this.stringToObjectId(id));
    return this.model.countDocuments({ _id: { $in: objectIds } });
  }

  async findByIds(ids: string[]): Promise<IUserFeed[]> {
    const objectIds = ids.map((id) => this.stringToObjectId(id));
    const docs = await this.model.find({ _id: { $in: objectIds } }).lean();
    return docs.map((doc) =>
      this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId }),
    );
  }

  async findEligibleFeedsForDisable(
    feedIds: string[],
    eligibleDisabledCodes: UserFeedDisabledCode[],
  ): Promise<UserFeedForBulkOperation[]> {
    if (feedIds.length === 0) return [];

    const objectIds = feedIds.map((id) => this.stringToObjectId(id));
    const docs = await this.model
      .find({
        $and: [
          { _id: { $in: objectIds } },
          {
            $or: [
              { disabledCode: { $exists: false } },
              { disabledCode: { $in: eligibleDisabledCodes } },
            ],
          },
        ],
      })
      .select("_id user.discordUserId")
      .lean();

    return docs.map((doc) => ({
      id: (doc._id as Types.ObjectId).toString(),
      discordUserId: (doc as { user: { discordUserId: string } }).user
        .discordUserId,
    }));
  }

  async findEligibleFeedsForEnable(
    feedIds: string[],
  ): Promise<UserFeedForBulkOperation[]> {
    if (feedIds.length === 0) return [];

    const objectIds = feedIds.map((id) => this.stringToObjectId(id));
    const docs = await this.model
      .find({
        _id: { $in: objectIds },
        disabledCode: UserFeedDisabledCode.Manual,
      })
      .select("_id user.discordUserId")
      .lean();

    return docs.map((doc) => ({
      id: (doc._id as Types.ObjectId).toString(),
      discordUserId: (doc as { user: { discordUserId: string } }).user
        .discordUserId,
    }));
  }

  async findDiscordUserIdsByFeedIds(feedIds: string[]): Promise<string[]> {
    if (feedIds.length === 0) return [];

    const objectIds = feedIds.map((id) => this.stringToObjectId(id));
    const docs = await this.model
      .find({ _id: { $in: objectIds } })
      .select("user.discordUserId")
      .lean();

    const userIds = docs.map(
      (doc) => (doc as { user: { discordUserId: string } }).user.discordUserId,
    );
    return [...new Set(userIds)];
  }

  async findManyWithConnectionsByFilter(
    filter: Record<string, unknown>,
  ): Promise<UserFeedWithConnections[]> {
    const docs = await this.model.find(filter).select("_id connections").lean();
    return docs.map((doc) => {
      const docWithId = doc as UserFeedDoc & { _id: Types.ObjectId };
      const discordChannels = docWithId.connections
        .discordChannels as unknown as DiscordChannelConnectionDoc[];
      return {
        id: this.objectIdToString(docWithId._id),
        connections: {
          discordChannels: discordChannels.map((conn) =>
            this.mapDiscordChannelConnection(conn),
          ),
        },
      };
    });
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

  async disableFeedsByIds(
    feedIds: string[],
    disabledCode: UserFeedDisabledCode,
  ): Promise<void> {
    if (feedIds.length === 0) {
      return;
    }

    const objectIds = feedIds.map((id) => this.stringToObjectId(id));
    await this.model.updateMany(
      { _id: { $in: objectIds } },
      { $set: { disabledCode } },
    );
  }

  async enableFeedsByIds(feedIds: string[]): Promise<void> {
    if (feedIds.length === 0) {
      return;
    }

    const objectIds = feedIds.map((id) => this.stringToObjectId(id));
    await this.model.updateMany(
      { _id: { $in: objectIds } },
      { $unset: { disabledCode: "" } },
    );
  }

  async enforceWebhookConnections(
    target: WebhookEnforcementTarget,
  ): Promise<void> {
    if (target.type === "all-users" || !target.allowWebhooks) {
      const userFilter =
        target.type === "all-users"
          ? { $nin: target.supporterDiscordUserIds }
          : target.discordUserId;

      await this.model.updateMany(
        {
          "user.discordUserId": userFilter,
          "connections.discordChannels": {
            $elemMatch: {
              "details.webhook.id": { $exists: true },
              disabledCode: {
                $nin: [
                  FeedConnectionDisabledCode.NotPaidSubscriber,
                  FeedConnectionDisabledCode.Manual,
                ],
              },
            },
          },
        },
        {
          $set: {
            "connections.discordChannels.$[].disabledCode":
              FeedConnectionDisabledCode.NotPaidSubscriber,
          },
        },
      );
    }

    if (target.type === "all-users" || target.allowWebhooks) {
      const userFilter =
        target.type === "all-users"
          ? { $in: target.supporterDiscordUserIds }
          : target.discordUserId;

      await this.model.updateMany(
        {
          "user.discordUserId": userFilter,
          "connections.discordChannels": {
            $elemMatch: {
              "details.webhook.id": { $exists: true },
              disabledCode: {
                $eq: FeedConnectionDisabledCode.NotPaidSubscriber,
              },
            },
          },
        },
        {
          $unset: { "connections.discordChannels.$[].disabledCode": "" },
        },
      );
    }
  }

  async enforceRefreshRates(
    target: RefreshRateEnforcementTarget,
    supporterRefreshRateSeconds: number,
  ): Promise<void> {
    if (target.type === "all-users") {
      const supporterDiscordUserIds = target.supporterLimits
        .filter(
          ({ refreshRateSeconds }) =>
            refreshRateSeconds === supporterRefreshRateSeconds,
        )
        .map(({ discordUserId }) => discordUserId);

      await this.model.updateMany(
        {
          userRefreshRateSeconds: supporterRefreshRateSeconds,
          "user.discordUserId": { $nin: supporterDiscordUserIds },
        },
        { $unset: { userRefreshRateSeconds: "" } },
      );
    } else {
      if (target.refreshRateSeconds === supporterRefreshRateSeconds) {
        return;
      }

      await this.model.updateMany(
        {
          userRefreshRateSeconds: supporterRefreshRateSeconds,
          "user.discordUserId": target.discordUserId,
        },
        { $unset: { userRefreshRateSeconds: "" } },
      );
    }
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

  async cloneConnectionToFeeds(
    input: CloneConnectionToFeedsInput,
  ): Promise<CloneConnectionToFeedsResult> {
    const { targetFeedIds, ownershipDiscordUserId, search, connectionData } =
      input;

    const useSelectedFeeds = targetFeedIds && targetFeedIds.length > 0;

    let feedQuery: Record<string, unknown>;

    if (useSelectedFeeds) {
      feedQuery = {
        _id: {
          $in: targetFeedIds.map((id) => this.stringToObjectId(id)),
        },
      };
    } else if (ownershipDiscordUserId) {
      feedQuery = {
        $and: [
          this.getOwnershipFilter(ownershipDiscordUserId),
          ...(search ? [this.getSearchFilter(search)] : []),
        ],
      };
    } else {
      feedQuery = {};
    }

    const feedsToUpdate = this.model.find(feedQuery).cursor();
    const bulkWriteDocs: Parameters<typeof this.model.bulkWrite>[0] = [];
    const feedIdToConnectionId: Array<{
      feedId: string;
      connectionId: string;
    }> = [];

    for await (const feed of feedsToUpdate) {
      const feedDoc = feed as { _id: Types.ObjectId };
      const newConnectionId = this.generateId();

      feedIdToConnectionId.push({
        feedId: feedDoc._id.toString(),
        connectionId: newConnectionId,
      });

      bulkWriteDocs.push({
        updateOne: {
          filter: { _id: feedDoc._id },
          update: {
            $push: {
              "connections.discordChannels": {
                ...connectionData,
                id: this.stringToObjectId(newConnectionId),
              },
            },
          } as Record<string, unknown>,
        },
      });
    }

    if (bulkWriteDocs.length > 0) {
      await this.model.bulkWrite(bulkWriteDocs);
    }

    return { feedIdToConnectionId };
  }

  private buildCopySettingsFilter(target: CopySettingsTarget) {
    const ownershipFilter = this.getOwnershipFilter(target.ownerDiscordUserId);

    if (target.type === "selected" && target.feedIds) {
      return {
        _id: {
          $in: target.feedIds.map((id) => this.stringToObjectId(id)),
        },
        ...ownershipFilter,
      };
    }

    const andConditions: Record<string, unknown>[] = [ownershipFilter];

    if (target.search) {
      andConditions.push(this.getSearchFilter(target.search));
    }

    return {
      _id: {
        $ne: this.stringToObjectId(target.excludeFeedId),
      },
      $and: andConditions,
    };
  }

  async copySettingsToFeeds(input: CopySettingsToFeedsInput): Promise<number> {
    const { target, settings } = input;

    const filter = this.buildCopySettingsFilter(target);

    const setQuery: Record<string, unknown> = {};
    const unsetQuery: Record<string, unknown> = {};

    if (settings.passingComparisons !== undefined) {
      setQuery.passingComparisons = settings.passingComparisons;
    }

    if (settings.blockingComparisons !== undefined) {
      setQuery.blockingComparisons = settings.blockingComparisons;
    }

    if (settings.externalProperties !== undefined) {
      setQuery.externalProperties = settings.externalProperties?.map((p) => ({
        ...p,
        id: new Types.ObjectId().toHexString(),
      }));
    }

    if (settings.dateCheckOptions !== undefined) {
      setQuery.dateCheckOptions = settings.dateCheckOptions;
    }

    if (settings.formatOptions !== undefined) {
      setQuery.formatOptions = settings.formatOptions;
    }

    if (settings.userRefreshRateSeconds !== undefined) {
      if (settings.userRefreshRateSeconds === null) {
        unsetQuery.userRefreshRateSeconds = "";
      } else {
        setQuery.userRefreshRateSeconds = settings.userRefreshRateSeconds;
      }
    }

    if (settings.connections !== undefined) {
      setQuery.connections = {
        discordChannels: settings.connections.discordChannels.map((c) => ({
          ...c,
          id: new Types.ObjectId().toHexString(),
        })),
      };
    }

    const updateDoc: Record<string, unknown> = {};

    if (Object.keys(setQuery).length > 0) {
      updateDoc.$set = setQuery;
    }

    if (Object.keys(unsetQuery).length > 0) {
      updateDoc.$unset = unsetQuery;
    }

    if (Object.keys(updateDoc).length === 0) {
      return 0;
    }

    const result = await this.model.updateMany(filter, updateDoc);

    return result.modifiedCount;
  }

  async findFeedsWithApplicationOwnedWebhooks(
    target: CopySettingsTarget,
  ): Promise<UserFeedWithConnections[]> {
    const baseFilter = this.buildCopySettingsFilter(target);

    const filter = {
      ...baseFilter,
      "connections.discordChannels.details.webhook.isApplicationOwned": true,
    };

    const docs = await this.model.find(filter).select("_id connections").lean();

    return docs.map((doc) => {
      const docWithId = doc as UserFeedDoc & { _id: Types.ObjectId };
      const discordChannels = docWithId.connections
        .discordChannels as unknown as DiscordChannelConnectionDoc[];
      return {
        id: this.objectIdToString(docWithId._id),
        connections: {
          discordChannels: discordChannels.map((conn) =>
            this.mapDiscordChannelConnection(conn),
          ),
        },
      };
    });
  }

  async findByInviteIdAndOwner(
    inviteId: string,
    ownerDiscordUserId: string,
  ): Promise<IUserFeed | null> {
    const doc = await this.model
      .findOne({
        "user.discordUserId": ownerDiscordUserId,
        "shareManageOptions.invites.id": this.stringToObjectId(inviteId),
      })
      .lean();

    if (!doc) {
      return null;
    }

    return this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId });
  }

  async findByInviteIdAndInvitee(
    inviteId: string,
    inviteeDiscordUserId: string,
  ): Promise<IUserFeed | null> {
    const doc = await this.model
      .findOne({
        "shareManageOptions.invites": {
          $elemMatch: {
            id: this.stringToObjectId(inviteId),
            discordUserId: inviteeDiscordUserId,
          },
        },
      })
      .lean();

    if (!doc) {
      return null;
    }

    return this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId });
  }

  async deleteInviteFromFeed(feedId: string, inviteId: string): Promise<void> {
    await this.model.updateOne(
      { _id: this.stringToObjectId(feedId) },
      {
        $pull: {
          "shareManageOptions.invites": {
            id: this.stringToObjectId(inviteId),
          },
        },
      },
    );
  }

  async updateInviteStatus(
    feedId: string,
    inviteId: string,
    status: UserFeedManagerStatus,
  ): Promise<IUserFeed | null> {
    const doc = await this.model
      .findOneAndUpdate(
        {
          _id: this.stringToObjectId(feedId),
          "shareManageOptions.invites.id": this.stringToObjectId(inviteId),
        },
        {
          $set: {
            "shareManageOptions.invites.$.status": status,
          },
        },
        { new: true },
      )
      .lean();

    if (!doc) {
      return null;
    }

    return this.toEntity(doc as UserFeedDoc & { _id: Types.ObjectId });
  }

  async addInviteToFeed(
    feedId: string,
    invite: AddInviteToFeedInput,
  ): Promise<void> {
    const inviteDoc = {
      id: new Types.ObjectId(),
      discordUserId: invite.discordUserId,
      type: invite.type,
      status: invite.status,
      connections: invite.connections?.map((c) => ({
        connectionId: this.stringToObjectId(c.connectionId),
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const feed = await this.model
      .findById(this.stringToObjectId(feedId))
      .lean();

    if (!feed) {
      throw new Error(`Feed ${feedId} not found`);
    }

    if (!feed.shareManageOptions) {
      await this.model.updateOne(
        { _id: this.stringToObjectId(feedId) },
        {
          $set: {
            shareManageOptions: { invites: [inviteDoc] },
          },
        },
      );
    } else {
      await this.model.updateOne(
        { _id: this.stringToObjectId(feedId) },
        {
          $push: {
            "shareManageOptions.invites": inviteDoc,
          },
        },
      );
    }
  }

  async updateInvite(
    feedId: string,
    inviteIndex: number,
    updates: UpdateInviteRepoInput,
  ): Promise<void> {
    const setUpdates: Record<string, unknown> = {};
    const unsetUpdates: Record<string, unknown> = {};

    if (updates.status !== undefined) {
      setUpdates[`shareManageOptions.invites.${inviteIndex}.status`] =
        updates.status;
    }

    if (updates.connections !== undefined) {
      if (updates.connections === null) {
        unsetUpdates[`shareManageOptions.invites.${inviteIndex}.connections`] =
          "";
      } else {
        setUpdates[`shareManageOptions.invites.${inviteIndex}.connections`] =
          updates.connections.map((c) => ({
            connectionId: this.stringToObjectId(c.connectionId),
          }));
      }
    }

    const updateDoc: Record<string, unknown> = {};

    if (Object.keys(setUpdates).length > 0) {
      updateDoc.$set = setUpdates;
    }

    if (Object.keys(unsetUpdates).length > 0) {
      updateDoc.$unset = unsetUpdates;
    }

    if (Object.keys(updateDoc).length > 0) {
      await this.model.updateOne(
        { _id: this.stringToObjectId(feedId) },
        updateDoc,
      );
    }
  }

  async transferFeedOwnership(
    feedId: string,
    newOwnerDiscordUserId: string,
  ): Promise<void> {
    await this.model.updateOne(
      { _id: this.stringToObjectId(feedId) },
      {
        $set: {
          "user.discordUserId": newOwnerDiscordUserId,
          "shareManageOptions.invites": [],
        },
      },
    );
  }

  async findFeedsWithPendingInvitesForUser(
    discordUserId: string,
  ): Promise<UserFeedForPendingInvites[]> {
    const docs = await this.model
      .find({
        "shareManageOptions.invites": {
          $elemMatch: {
            discordUserId,
            status: UserFeedManagerStatus.Pending,
          },
        },
      })
      .select("_id title url user shareManageOptions")
      .lean();

    return docs.map((doc) => ({
      id: (doc._id as Types.ObjectId).toString(),
      title: doc.title,
      url: doc.url,
      user: { discordUserId: doc.user.discordUserId },
      shareManageOptions: {
        invites: (
          doc.shareManageOptions!.invites as unknown as ShareManageUserDoc[]
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
      },
    }));
  }

  async countPendingInvitesForUser(discordUserId: string): Promise<number> {
    return this.model.countDocuments({
      "shareManageOptions.invites": {
        $elemMatch: {
          discordUserId,
          status: UserFeedManagerStatus.Pending,
        },
      },
    });
  }

  async findDebugFeedUrls(): Promise<Set<string>> {
    const docs = await this.model.find({ debug: true }).select("url").lean();

    return new Set(docs.map((d) => d.url));
  }

  async syncRefreshRates(input: RefreshRateSyncInput): Promise<void> {
    const { supporterLimits, defaultRefreshRateSeconds } = input;

    const allSupporterUserIds = supporterLimits.flatMap(
      (s) => s.discordUserIds,
    );

    const bulkOps: Parameters<typeof this.model.bulkWrite>[0] = [
      ...supporterLimits.map(({ discordUserIds, refreshRateSeconds }) => ({
        updateMany: {
          filter: {
            "user.discordUserId": { $in: discordUserIds },
            refreshRateSeconds: { $ne: refreshRateSeconds },
          },
          update: { $set: { refreshRateSeconds } },
        },
      })),
      {
        updateMany: {
          filter: {
            "user.discordUserId": { $nin: allSupporterUserIds },
            refreshRateSeconds: { $ne: defaultRefreshRateSeconds },
          },
          update: { $set: { refreshRateSeconds: defaultRefreshRateSeconds } },
        },
      },
    ];

    if (bulkOps.length > 0) {
      await this.model.bulkWrite(bulkOps);
    }
  }

  async syncMaxDailyArticles(input: MaxDailyArticlesSyncInput): Promise<void> {
    const { supporterLimits, defaultMaxDailyArticles } = input;

    const allSupporterUserIds = supporterLimits.flatMap(
      (s) => s.discordUserIds,
    );

    const bulkOps: Parameters<typeof this.model.bulkWrite>[0] = [
      ...supporterLimits.map(({ discordUserIds, maxDailyArticles }) => ({
        updateMany: {
          filter: {
            "user.discordUserId": { $in: discordUserIds },
            maxDailyArticles: { $ne: maxDailyArticles },
          },
          update: { $set: { maxDailyArticles } },
        },
      })),
      {
        updateMany: {
          filter: {
            "user.discordUserId": { $nin: allSupporterUserIds },
            maxDailyArticles: { $ne: defaultMaxDailyArticles },
          },
          update: { $set: { maxDailyArticles: defaultMaxDailyArticles } },
        },
      },
    ];

    if (bulkOps.length > 0) {
      await this.model.bulkWrite(bulkOps);
    }
  }

  async *iterateFeedsForRefreshRateSync(
    input: RefreshRateSyncInput,
  ): AsyncIterable<
    FeedForSlotOffsetRecalculation & { newRefreshRateSeconds: number }
  > {
    const { supporterLimits, defaultRefreshRateSeconds } = input;
    const allSupporterUserIds = supporterLimits.flatMap(
      (s) => s.discordUserIds,
    );

    for (const { discordUserIds, refreshRateSeconds } of supporterLimits) {
      const cursor = this.model
        .find({
          "user.discordUserId": { $in: discordUserIds },
          refreshRateSeconds: { $ne: refreshRateSeconds },
        })
        .select("_id url userRefreshRateSeconds")
        .lean()
        .cursor();

      for await (const feed of cursor) {
        yield {
          id: (feed._id as Types.ObjectId).toString(),
          url: feed.url as string,
          userRefreshRateSeconds: feed.userRefreshRateSeconds as
            | number
            | undefined,
          newRefreshRateSeconds: refreshRateSeconds,
        };
      }
    }

    const cursor = this.model
      .find({
        "user.discordUserId": { $nin: allSupporterUserIds },
        refreshRateSeconds: { $ne: defaultRefreshRateSeconds },
      })
      .select("_id url userRefreshRateSeconds")
      .lean()
      .cursor();

    for await (const feed of cursor) {
      yield {
        id: (feed._id as Types.ObjectId).toString(),
        url: feed.url as string,
        userRefreshRateSeconds: feed.userRefreshRateSeconds as
          | number
          | undefined,
        newRefreshRateSeconds: defaultRefreshRateSeconds,
      };
    }
  }

  async *iterateUrlsForRefreshRate(
    refreshRateSeconds: number,
    slotWindow: SlotWindow,
  ): AsyncIterable<{ url: string }> {
    const pipeline = getCommonFeedAggregateStages({
      refreshRateSeconds,
      slotWindow,
    });
    pipeline.push({ $group: { _id: "$url" } });

    const cursor = this.model
      .aggregate(pipeline, {
        readPreference: "secondaryPreferred",
      })
      .cursor();

    for await (const doc of cursor) {
      if (doc._id) {
        yield { url: doc._id };
      }
    }
  }

  async *iterateFeedsWithLookupKeysForRefreshRate(
    refreshRateSeconds: number,
    slotWindow: SlotWindow,
  ): AsyncIterable<ScheduledFeedWithLookupKey> {
    const pipeline = getCommonFeedAggregateStages({
      refreshRateSeconds,
      slotWindow,
      withLookupKeys: true,
    });
    pipeline.push({ $project: { url: 1, feedRequestLookupKey: 1, users: 1 } });

    const cursor = this.model
      .aggregate(pipeline, {
        readPreference: "secondaryPreferred",
      })
      .cursor();

    for await (const doc of cursor) {
      yield {
        url: doc.url,
        feedRequestLookupKey: doc.feedRequestLookupKey,
        users: doc.users || [],
      };
    }
  }

  async updateHealthStatusByFilter(
    filter: { url?: string; lookupKey?: string },
    healthStatus: UserFeedHealthStatus,
    excludeStatus?: UserFeedHealthStatus,
  ): Promise<number> {
    const queryFilter: Record<string, unknown> = filter.lookupKey
      ? { feedRequestLookupKey: filter.lookupKey }
      : { url: filter.url };

    if (excludeStatus) {
      queryFilter.healthStatus = { $ne: excludeStatus };
    }

    const result = await this.model.updateMany(queryFilter, {
      $set: { healthStatus },
    });

    return result.modifiedCount;
  }

  async countWithHealthStatusFilter(
    filter: { url?: string; lookupKey?: string },
    excludeHealthStatus: UserFeedHealthStatus,
  ): Promise<number> {
    const queryFilter: Record<string, unknown> = filter.lookupKey
      ? { feedRequestLookupKey: filter.lookupKey }
      : { url: filter.url };

    queryFilter.healthStatus = { $ne: excludeHealthStatus };

    return this.model.countDocuments(queryFilter);
  }

  async *iterateFeedsForDelivery(params: {
    url: string;
    refreshRateSeconds: number;
    debug?: boolean;
  }): AsyncIterable<UserFeedForDelivery> {
    const pipeline = getCommonFeedAggregateStages({
      url: params.url,
      refreshRateSeconds: params.refreshRateSeconds,
    });

    const cursor = this.model.aggregate(pipeline).cursor();

    for await (const doc of cursor) {
      yield this.mapToUserFeedForDelivery(doc);
    }
  }

  async *iterateFeedsWithLookupKeysForDelivery(params: {
    lookupKey: string;
    refreshRateSeconds: number;
    debug?: boolean;
  }): AsyncIterable<UserFeedForDelivery> {
    const pipeline = getCommonFeedAggregateStages({
      feedRequestLookupKey: params.lookupKey,
      refreshRateSeconds: params.refreshRateSeconds,
    });

    const cursor = this.model.aggregate(pipeline).cursor();

    for await (const doc of cursor) {
      yield this.mapToUserFeedForDelivery(doc);
    }
  }

  private mapToUserFeedForDelivery(
    doc: Record<string, unknown>,
  ): UserFeedForDelivery {
    const typedDoc = doc as {
      _id: Types.ObjectId;
      url: string;
      debug?: boolean;
      maxDailyArticles?: number;
      connections: { discordChannels: DiscordChannelConnectionDoc[] };
      passingComparisons?: string[];
      blockingComparisons?: string[];
      formatOptions?: Record<string, unknown>;
      externalProperties?: Array<Record<string, unknown>>;
      dateCheckOptions?: Record<string, unknown>;
      feedRequestLookupKey?: string;
      user: { discordUserId: string };
      users?: Array<{
        externalCredentials?: Array<{
          type: string;
          data: Record<string, string>;
        }>;
        preferences?: Record<string, unknown>;
      }>;
    };

    return {
      id: typedDoc._id.toString(),
      url: typedDoc.url,
      debug: typedDoc.debug,
      maxDailyArticles: typedDoc.maxDailyArticles,
      connections: {
        discordChannels: typedDoc.connections.discordChannels.map((conn) =>
          this.mapDiscordChannelConnection(conn),
        ),
      },
      passingComparisons: typedDoc.passingComparisons,
      blockingComparisons: typedDoc.blockingComparisons,
      formatOptions:
        typedDoc.formatOptions as UserFeedForDelivery["formatOptions"],
      externalProperties:
        typedDoc.externalProperties as UserFeedForDelivery["externalProperties"],
      dateCheckOptions:
        typedDoc.dateCheckOptions as UserFeedForDelivery["dateCheckOptions"],
      feedRequestLookupKey: typedDoc.feedRequestLookupKey,
      user: { discordUserId: typedDoc.user.discordUserId },
      users: typedDoc.users || [],
    };
  }

  async findIdsWithoutDisabledCode(filter: {
    url?: string;
    lookupKey?: string;
  }): Promise<string[]> {
    const queryFilter: Record<string, unknown> = filter.lookupKey
      ? { feedRequestLookupKey: filter.lookupKey }
      : { url: filter.url };

    queryFilter.disabledCode = { $exists: false };

    const docs = await this.model.find(queryFilter).select("_id").lean();

    return docs.map((doc) => (doc._id as Types.ObjectId).toString());
  }

  async setConnectionDisabledCode(
    feedId: string,
    connectionKey: string,
    connectionIndex: number,
    disabledCode: FeedConnectionDisabledCode,
    disabledDetail?: string,
  ): Promise<void> {
    const updateDoc: Record<string, unknown> = {
      [`connections.${connectionKey}.${connectionIndex}.disabledCode`]:
        disabledCode,
    };

    if (disabledDetail !== undefined) {
      updateDoc[
        `connections.${connectionKey}.${connectionIndex}.disabledDetail`
      ] = disabledDetail;
    }

    await this.model.updateOne(
      {
        _id: this.stringToObjectId(feedId),
        [`connections.${connectionKey}.${connectionIndex}.disabledCode`]: {
          $exists: false,
        },
      },
      { $set: updateDoc },
    );
  }

  async disableFeedsAndSetHealthStatus(
    feedIds: string[],
    disabledCode: UserFeedDisabledCode,
    healthStatus: UserFeedHealthStatus,
  ): Promise<void> {
    if (feedIds.length === 0) {
      return;
    }

    const objectIds = feedIds.map((id) => this.stringToObjectId(id));
    await this.model.updateMany(
      { _id: { $in: objectIds } },
      {
        $set: {
          disabledCode,
          healthStatus,
        },
      },
    );
  }

  async disableFeedByIdIfNotDisabled(
    feedId: string,
    disabledCode: UserFeedDisabledCode,
  ): Promise<boolean> {
    const result = await this.model.updateOne(
      {
        _id: this.stringToObjectId(feedId),
        disabledCode: { $exists: false },
      },
      { $set: { disabledCode } },
    );

    return result.modifiedCount > 0;
  }

  async disableFeedsByFilterIfNotDisabled(
    filter: { url?: string; lookupKey?: string },
    disabledCode: UserFeedDisabledCode,
  ): Promise<number> {
    const queryFilter: Record<string, unknown> = filter.lookupKey
      ? { feedRequestLookupKey: filter.lookupKey }
      : { url: filter.url };

    queryFilter.disabledCode = { $exists: false };

    const result = await this.model.updateMany(queryFilter, {
      $set: { disabledCode },
    });

    return result.modifiedCount;
  }
}
