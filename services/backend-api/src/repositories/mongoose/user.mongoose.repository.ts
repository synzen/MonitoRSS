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

const REDDIT_URL_REGEX = /^http(s?):\/\/(www.)?(\w+\.)?reddit\.com\/r\//i;

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
    const setQueries = Object.entries(credential.data).reduce(
      (acc, [key, value]) => {
        acc[`externalCredentials.$.data.${key}`] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    const finalSetQuery = {
      ...setQueries,
      ...(credential.expireAt && {
        "externalCredentials.$.expireAt": credential.expireAt,
      }),
    };

    const result = await this.model.updateOne(
      {
        _id: this.stringToObjectId(userId),
        externalCredentials: {
          $elemMatch: { type: credential.type },
        },
      },
      { $set: finalSetQuery },
    );

    if (!result.modifiedCount) {
      await this.model.updateOne(
        { _id: this.stringToObjectId(userId) },
        {
          $push: {
            externalCredentials: {
              type: credential.type,
              data: credential.data,
              expireAt: credential.expireAt,
              status: UserExternalCredentialStatus.Active,
            },
          },
        },
      );
    }
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

    let data: Record<string, string> = {};
    if (credential.data) {
      if (credential.data instanceof Map) {
        data = Object.fromEntries(credential.data);
      } else {
        data = credential.data as Record<string, string>;
      }
    }

    return {
      id: this.objectIdToString(credential._id) as string,
      type: credential.type,
      status: credential.status,
      data,
      expireAt: credential.expireAt,
    };
  }

  async removeExternalCredentials(
    userId: string,
    type: UserExternalCredentialType,
  ): Promise<void> {
    await this.model.updateOne(
      { _id: this.stringToObjectId(userId) },
      { $pull: { externalCredentials: { type } } },
    );
  }

  async revokeExternalCredential(
    userId: string,
    credentialId: string,
  ): Promise<void> {
    await this.model.updateOne(
      {
        _id: this.stringToObjectId(userId),
        "externalCredentials._id": this.stringToObjectId(credentialId),
      },
      {
        $set: {
          "externalCredentials.$.status": UserExternalCredentialStatus.Revoked,
        },
      },
    );
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
            externalCredentials: {
              $elemMatch: {
                expireAt: { $gt: new Date() },
                status: UserExternalCredentialStatus.Active,
                type: UserExternalCredentialType.Reddit,
              },
            },
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
    const cursor = this.model
      .aggregate([
        {
          $match: {
            ...(options?.userIds?.length && {
              _id: {
                $in: options.userIds.map((id) => this.stringToObjectId(id)),
              },
            }),
            $or: [
              {
                externalCredentials: {
                  $elemMatch: {
                    type: UserExternalCredentialType.Reddit,
                    expireAt: { $lte: new Date() },
                  },
                },
              },
              {
                externalCredentials: {
                  $elemMatch: {
                    type: UserExternalCredentialType.Reddit,
                    status: UserExternalCredentialStatus.Revoked,
                  },
                },
              },
              {
                "externalCredentials.0": { $exists: false },
              },
            ],
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
            "feeds.feedRequestLookupKey": { $exists: true },
            ...(options?.feedIds?.length && {
              "feeds._id": {
                $in: options.feedIds.map((id) => this.stringToObjectId(id)),
              },
            }),
          },
        },
        {
          $project: {
            feedId: "$feeds._id",
            _id: 0,
          },
        },
      ])
      .cursor();

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
      .find({
        externalCredentials: {
          $elemMatch: {
            type: UserExternalCredentialType.Reddit,
            status: UserExternalCredentialStatus.Active,
            "data.accessToken": { $exists: true },
            "data.refreshToken": { $exists: true },
            expireAt: {
              $exists: true,
              $lte: expirationThreshold,
            },
          },
        },
      })
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

      const redditCredential = typedDoc.externalCredentials?.find(
        (c) => c.type === UserExternalCredentialType.Reddit,
      );

      if (!redditCredential) {
        continue;
      }

      const refreshToken = redditCredential.data?.refreshToken as
        | string
        | undefined;

      if (!refreshToken) {
        continue;
      }

      yield {
        userId: this.objectIdToString(typedDoc._id),
        discordUserId: typedDoc.discordUserId,
        credentialId: this.objectIdToString(redditCredential._id),
        encryptedRefreshToken: refreshToken,
      };
    }
  }
}
