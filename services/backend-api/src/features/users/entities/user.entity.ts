import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model, Types, Schema as MongooseSchema } from "mongoose";
import { UserExternalCredentialType } from "../../../common/constants/user-external-credential-type.constants";

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
    type: MongooseSchema.Types.Mixed,
  })
  data: Record<string, unknown>;

  @Prop({
    required: false,
    type: Date,
  })
  expireAt?: Date;
}

export const UserExternalCredentialSchema =
  SchemaFactory.createForClass(UserFeatureFlags);

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
