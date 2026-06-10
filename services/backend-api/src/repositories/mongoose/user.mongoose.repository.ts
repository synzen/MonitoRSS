import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
  type UpdateQuery,
} from "mongoose";
import type {
  IUser,
  IUserRepository,
  CreateUserInput,
  UpdateUserPreferencesInput,
  SetExternalCredentialInput,
  IUserExternalCredential,
} from "../interfaces/user.types";
import {
  UserExternalCredentialStatus,
  UserExternalCredentialType,
} from "../shared/enums";
import { BaseMongooseRepository } from "./base.mongoose.repository";
import {
  REDDIT_URL_REGEX,
  activeRedditCredentialElemMatch,
  expiredOrRevokedRedditCredentialConditions,
  expiringActiveRedditCredentialFilter,
  extractRedditRefreshCredential,
  normalizeExternalCredentialData,
  removeExternalCredentialsByType,
  revokeExternalCredentialById,
  upsertExternalCredential,
} from "./external-credentials.subdocument";

const UserFeedListSortSchema = new Schema(
  {
    key: { type: String, required: true },
    direction: { type: String, required: true, enum: ["asc", "desc"] },
  },
  { _id: false, timestamps: false },
);

const UserFeedListColumnVisibilitySchema = new Schema(
  {
    computedStatus: { type: Boolean },
    title: { type: Boolean },
    url: { type: Boolean },
    createdAt: { type: Boolean },
    ownedByUser: { type: Boolean },
    refreshRateSeconds: { type: Boolean },
  },
  { _id: false, timestamps: false },
);

const UserFeedListColumnOrderSchema = new Schema(
  {
    columns: { type: [String] },
  },
  { _id: false, timestamps: false },
);

const UserFeedListStatusFiltersSchema = new Schema(
  {
    statuses: { type: [String] },
  },
  { _id: false, timestamps: false },
);

const UserPreferencesSchema = new Schema(
  {
    alertOnDisabledFeeds: { type: Boolean },
    dateFormat: { type: String },
    dateTimezone: { type: String },
    dateLocale: { type: String },
    feedListSort: { type: UserFeedListSortSchema },
    feedListColumnVisibility: { type: UserFeedListColumnVisibilitySchema },
    feedListColumnOrder: { type: UserFeedListColumnOrderSchema },
    feedListStatusFilters: { type: UserFeedListStatusFiltersSchema },
  },
  { _id: false, timestamps: false },
);

const UserFeatureFlagsSchema = new Schema(
  {
    externalProperties: { type: Boolean },
    workspaces: { type: Boolean },
  },
  { _id: false, timestamps: false },
);

const UserExternalCredentialSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: Object.values(UserExternalCredentialType),
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(UserExternalCredentialStatus),
      default: UserExternalCredentialStatus.Active,
    },
    data: { type: Map, of: Schema.Types.Mixed },
    expireAt: { type: Date },
  },
  { timestamps: false },
);

const UserSchema = new Schema(
  {
    discordUserId: { type: String, required: true, unique: true },
    email: { type: String },
    verifiedEmail: { type: String },
    verifiedEmailVerifiedAt: { type: Date },
    preferences: { type: UserPreferencesSchema, default: {} },
    featureFlags: { type: UserFeatureFlagsSchema, default: {} },
    enableBilling: { type: Boolean },
    externalCredentials: { type: [UserExternalCredentialSchema] },
  },
  { timestamps: true },
);

UserSchema.index({
  "externalCredentials.expireAt": 1,
  "externalCredentials.status": 1,
  "externalCredentials.type": 1,
});

UserSchema.index({
  "externalCredentials.0": 1,
});

UserSchema.index({ verifiedEmail: 1 }, { unique: true, sparse: true });

type UserDoc = InferSchemaType<typeof UserSchema>;

export class UserMongooseRepository
  extends BaseMongooseRepository<IUser, UserDoc>
  implements IUserRepository
{
  private model: Model<UserDoc>;
  private connection: Connection;

  constructor(connection: Connection) {
    super();
    this.connection = connection;
    this.model = connection.model<UserDoc>("User", UserSchema);
  }

  protected toEntity(doc: UserDoc & { _id: Types.ObjectId }): IUser {
    return {
      id: this.objectIdToString(doc._id),
      discordUserId: doc.discordUserId,
      email: doc.email,
      verifiedEmail: doc.verifiedEmail,
      verifiedEmailVerifiedAt: doc.verifiedEmailVerifiedAt,
      preferences: doc.preferences,
      featureFlags: doc.featureFlags,
      enableBilling: doc.enableBilling,
      externalCredentials: doc.externalCredentials?.map((cred) => {
        let data: Record<string, string> = {};
        if (cred.data) {
          if (cred.data instanceof Map) {
            data = Object.fromEntries(cred.data);
          } else {
            data = cred.data as Record<string, string>;
          }
        }
        return {
          id: this.objectIdToString(cred._id) as string,
          type: cred.type,
          status: cred.status,
          data,
          expireAt: cred.expireAt,
        };
      }),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async findById(id: string): Promise<IUser | null> {
    const doc = await this.model.findById(this.stringToObjectId(id)).lean();
    return doc ? this.toEntity(doc as UserDoc & { _id: Types.ObjectId }) : null;
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const doc = await this.model.findOne({ email }).lean();
    return doc ? this.toEntity(doc as UserDoc & { _id: Types.ObjectId }) : null;
  }

  async findByVerifiedEmail(email: string): Promise<IUser | null> {
    const doc = await this.model.findOne({ verifiedEmail: email }).lean();
    return doc ? this.toEntity(doc as UserDoc & { _id: Types.ObjectId }) : null;
  }

  async findByDiscordId(discordUserId: string): Promise<IUser | null> {
    const doc = await this.model.findOne({ discordUserId }).lean();
    return doc ? this.toEntity(doc as UserDoc & { _id: Types.ObjectId }) : null;
  }

  async findIdByDiscordId(discordUserId: string): Promise<string | null> {
    const doc = await this.model
      .findOne({ discordUserId })
      .select("_id")
      .lean();
    return doc ? this.objectIdToString(doc._id) : null;
  }

  async create(input: CreateUserInput): Promise<IUser> {
    const doc = await this.model.create({
      discordUserId: input.discordUserId,
      email: input.email,
    });
    return this.toEntity(doc.toObject());
  }

  async updateEmailByDiscordId(
    discordUserId: string,
    email: string,
  ): Promise<IUser | null> {
    const doc = await this.model
      .findOneAndUpdate({ discordUserId }, { $set: { email } }, { new: true })
      .lean();
    return doc ? this.toEntity(doc as UserDoc & { _id: Types.ObjectId }) : null;
  }

  async setVerifiedEmail(userId: string, email: string): Promise<void> {
    await this.model.updateOne(
      { _id: this.stringToObjectId(userId) },
      { $set: { verifiedEmail: email, verifiedEmailVerifiedAt: new Date() } },
    );
  }

  async updatePreferencesByDiscordId(
    discordUserId: string,
    preferences: UpdateUserPreferencesInput,
  ): Promise<IUser | null> {
    const updateQuery: UpdateQuery<UserDoc> = {
      $set: {},
      $unset: {},
    };

    for (const [key, value] of Object.entries(preferences)) {
      if (value === null) {
        updateQuery.$unset![`preferences.${key}`] = "";
      } else if (value !== undefined) {
        updateQuery.$set![`preferences.${key}`] = value;
      }
    }

    if (Object.keys(updateQuery.$set!).length === 0) {
      delete updateQuery.$set;
    }
    if (Object.keys(updateQuery.$unset!).length === 0) {
      delete updateQuery.$unset;
    }

    const doc = await this.model
      .findOneAndUpdate({ discordUserId }, updateQuery, { new: true })
      .lean();
    return doc ? this.toEntity(doc as UserDoc & { _id: Types.ObjectId }) : null;
  }

  async findEmailsByDiscordIdsWithAlertPreference(
    discordUserIds: string[],
  ): Promise<string[]> {
    const emails = await this.model
      .find({
        discordUserId: { $in: discordUserIds },
        email: { $exists: true },
        "preferences.alertOnDisabledFeeds": true,
      })
      .distinct("email");
    return emails;
  }

  async setExternalCredential(
    userId: string,
    credential: SetExternalCredentialInput,
  ): Promise<void> {
    await upsertExternalCredential({
      model: this.model,
      ownerFilter: { _id: this.stringToObjectId(userId) },
      credential,
    });
  }

  async getExternalCredentials(
    userId: string,
    type: UserExternalCredentialType,
  ): Promise<IUserExternalCredential | null> {
    const doc = await this.model
      .findOne(
        { _id: this.stringToObjectId(userId) },
        { externalCredentials: 1 },
      )
      .lean();

    if (!doc) {
      return null;
    }

    const credential = doc.externalCredentials?.find((c) => c.type === type);
    if (!credential) {
      return null;
    }

    return {
      id: this.objectIdToString(credential._id) as string,
      type: credential.type,
      status: credential.status,
      data: normalizeExternalCredentialData(credential.data),
      expireAt: credential.expireAt,
    };
  }

  async removeExternalCredentials(
    userId: string,
    type: UserExternalCredentialType,
  ): Promise<void> {
    await removeExternalCredentialsByType({
      model: this.model,
      ownerFilter: { _id: this.stringToObjectId(userId) },
      type,
    });
  }

  async revokeExternalCredential(
    userId: string,
    credentialId: string,
  ): Promise<void> {
    await revokeExternalCredentialById({
      model: this.model,
      ownerFilter: { _id: this.stringToObjectId(userId) },
      credentialId: this.stringToObjectId(credentialId),
    });
  }

  async *aggregateUsersWithActiveRedditCredentials(options?: {
    userIds?: string[];
    feedIds?: string[];
  }): AsyncIterable<{
    discordUserId: string;
    feedId: string;
    lookupKey?: string;
  }> {
    const cursor = this.model
      .aggregate([
        {
          $match: {
            ...(options?.userIds?.length && {
              _id: {
                $in: options.userIds.map((id) => this.stringToObjectId(id)),
              },
            }),
            ...activeRedditCredentialElemMatch(),
          },
        },
        {
          $lookup: {
            from: "userfeeds",
            localField: "discordUserId",
            foreignField: "user.discordUserId",
            as: "feeds",
          },
        },
        { $unwind: { path: "$feeds" } },
        {
          $match: {
            "feeds.url": REDDIT_URL_REGEX,
            // Workspace feeds resolve credentials from their workspace, never
            // their creator's personal connection.
            "feeds.workspaceId": { $exists: false },
            ...(options?.feedIds?.length && {
              "feeds._id": {
                $in: options.feedIds.map((id) => this.stringToObjectId(id)),
              },
            }),
          },
        },
        {
          $project: {
            discordUserId: 1,
            feedId: "$feeds._id",
            lookupKey: "$feeds.feedRequestLookupKey",
            _id: 0,
          },
        },
      ])
      .cursor();

    for await (const doc of cursor) {
      yield {
        discordUserId: doc.discordUserId,
        feedId: this.objectIdToString(doc.feedId),
        lookupKey: doc.lookupKey,
      };
    }
  }

  async *aggregateUsersWithExpiredOrRevokedRedditCredentials(options?: {
    userIds?: string[];
    feedIds?: string[];
  }): AsyncIterable<{ feedId: string }> {
    const cursor = this.connection
      .collection("userfeeds")
      .aggregate([
        {
          $match: {
            feedRequestLookupKey: { $exists: true },
            url: REDDIT_URL_REGEX,
            // Workspace feeds' lookup keys are synced against workspace
            // credentials, not the creator's.
            workspaceId: { $exists: false },
            ...(options?.feedIds?.length && {
              _id: {
                $in: options.feedIds.map((id) => this.stringToObjectId(id)),
              },
            }),
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "user.discordUserId",
            foreignField: "discordUserId",
            as: "owner",
          },
        },
        {
          $set: {
            owner: { $arrayElemAt: ["$owner", 0] },
          },
        },
        ...(options?.userIds?.length
          ? [
              {
                $match: {
                  "owner._id": {
                    $in: options.userIds.map((id) =>
                      this.stringToObjectId(id),
                    ),
                  },
                },
              },
            ]
          : []),
        {
          $match: {
            owner: { $ne: null },
            $or: expiredOrRevokedRedditCredentialConditions("owner"),
          },
        },
        {
          $project: {
            feedId: "$_id",
            _id: 0,
          },
        },
      ]);

    for await (const doc of cursor) {
      yield {
        feedId: this.objectIdToString(doc.feedId),
      };
    }
  }

  async *iterateUsersWithExpiringRedditCredentials(
    withinMs: number,
  ): AsyncIterable<{
    userId: string;
    discordUserId: string;
    credentialId: string;
    encryptedRefreshToken: string;
  }> {
    const expirationThreshold = new Date(Date.now() + withinMs);

    const cursor = this.model
      .find(expiringActiveRedditCredentialFilter(expirationThreshold))
      .select("_id discordUserId externalCredentials")
      .lean()
      .cursor();

    for await (const doc of cursor) {
      const typedDoc = doc as {
        _id: Types.ObjectId;
        discordUserId: string;
        externalCredentials?: Array<{
          _id: Types.ObjectId;
          type: string;
          data?: Record<string, unknown>;
        }>;
      };

      const credential = extractRedditRefreshCredential(typedDoc);

      if (!credential) {
        continue;
      }

      yield {
        userId: this.objectIdToString(typedDoc._id),
        discordUserId: typedDoc.discordUserId,
        credentialId: this.objectIdToString(credential.credentialId),
        encryptedRefreshToken: credential.encryptedRefreshToken,
      };
    }
  }
}
