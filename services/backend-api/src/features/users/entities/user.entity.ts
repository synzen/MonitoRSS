import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model, Types, Schema as MongooseSchema } from "mongoose";
import { UserExternalCredentialType } from "../../../common/constants/user-external-credential-type.constants";
import { UserExternalCredentialStatus } from "../../../common/constants/user-external-credential-status.constants";

@Schema({
  timestamps: false,
  _id: false,
})
export class UserFeedListSort {
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  direction: "asc" | "desc";
}

export const UserFeedListSortSchema =
  SchemaFactory.createForClass(UserFeedListSort);

@Schema({
  timestamps: false,
  _id: false,
})
export class UserFeedListColumnVisibility {
  @Prop()
  computedStatus?: boolean;

  @Prop()
  title?: boolean;

  @Prop()
  url?: boolean;

  @Prop()
  createdAt?: boolean;

  @Prop()
  ownedByUser?: boolean;

  @Prop()
  refreshRate?: boolean;
}

export const UserFeedListColumnVisibilitySchema = SchemaFactory.createForClass(
  UserFeedListColumnVisibility
);

@Schema({
  timestamps: false,
  _id: false,
})
export class UserPreferences {
  @Prop()
  alertOnDisabledFeeds?: boolean;

  @Prop()
  dateFormat?: string;

  @Prop()
  dateTimezone?: string;

  @Prop()
  dateLocale?: string;

  @Prop({ type: UserFeedListSortSchema })
  feedListSort?: UserFeedListSort;

  @Prop({ type: UserFeedListColumnVisibilitySchema })
  feedListColumnVisibility?: UserFeedListColumnVisibility;
}

export const UserPreferencesSchema =
  SchemaFactory.createForClass(UserPreferences);

@Schema({
  timestamps: false,
  _id: false,
})
export class UserFeatureFlags {
  @Prop()
  externalProperties?: boolean;
}

export const UserFeatureFlagsSchema =
  SchemaFactory.createForClass(UserFeatureFlags);

@Schema({
  timestamps: false,
})
export class UserExternalCredential {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
  })
  type: UserExternalCredentialType;

  @Prop({
    required: true,
    enum: Object.values(UserExternalCredentialStatus),
    type: String,
    default: UserExternalCredentialStatus.Active,
  })
  status: UserExternalCredentialStatus = UserExternalCredentialStatus.Active;

  @Prop({
    type: MongooseSchema.Types.Map,
    of: MongooseSchema.Types.Mixed,
  })
  data: Record<string, string>;

  @Prop({
    required: false,
    type: Date,
  })
  expireAt?: Date;
}

export const UserExternalCredentialSchema = SchemaFactory.createForClass(
  UserExternalCredential
);

@Schema({
  timestamps: true,
})
export class User {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
  })
  discordUserId: string;

  @Prop({
    required: false,
  })
  email?: string;

  @Prop({
    required: false,
    type: UserPreferencesSchema,
    default: {},
  })
  preferences?: UserPreferences;

  @Prop({
    required: false,
    type: UserFeatureFlagsSchema,
    default: {},
  })
  featureFlags?: UserFeatureFlags;

  @Prop({
    required: false,
  })
  enableBilling?: boolean;

  @Prop({
    type: [UserExternalCredentialSchema],
  })
  externalCredentials?: UserExternalCredential[];

  createdAt: Date;

  updatedAt: Date;
}

export type UserDocument = User & Document;
export type UserModel = Model<UserDocument>;
export const UserSchema = SchemaFactory.createForClass(User);
export const UserFeature: ModelDefinition = {
  name: User.name,
  schema: UserSchema,
};

UserSchema.index({
  "externalCredentials.expireAt": 1,
  "externalCredentials.status": 1,
  "externalCredentials.type": 1,
});

UserSchema.index({
  "externalCredentials.0": 1,
});
