import {
  Schema,
  Types,
  type Connection,
  type Model,
  type InferSchemaType,
} from "mongoose";
import type { IUser, IUserRepository } from "../interfaces/user.types";
import {
  UserExternalCredentialStatus,
  UserExternalCredentialType,
} from "../shared/enums";
import { BaseMongooseRepository } from "./base.mongoose.repository";

const UserFeedListSortSchema = new Schema(
  {
    key: { type: String, required: true },
    direction: { type: String, required: true, enum: ["asc", "desc"] },
  },
  { _id: false, timestamps: false }
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
  { _id: false, timestamps: false }
);

const UserFeedListColumnOrderSchema = new Schema(
  {
    columns: { type: [String] },
  },
  { _id: false, timestamps: false }
);

const UserFeedListStatusFiltersSchema = new Schema(
  {
    statuses: { type: [String] },
  },
  { _id: false, timestamps: false }
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
  { _id: false, timestamps: false }
);

const UserFeatureFlagsSchema = new Schema(
  {
    externalProperties: { type: Boolean },
  },
  { _id: false, timestamps: false }
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
  { timestamps: false, }
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
  { timestamps: true }
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

  constructor(connection: Connection) {
    super();
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
      externalCredentials: doc.externalCredentials?.map((cred) => ({
        id: this.objectIdToString(cred._id) as string,
        type: cred.type,
        status: cred.status,
        data: cred.data ? Object.fromEntries(cred.data) : {},
        expireAt: cred.expireAt,
      })),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
