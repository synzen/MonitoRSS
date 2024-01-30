import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model, Types } from "mongoose";

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
  })
  preferences?: UserPreferences;

  @Prop({
    required: false,
  })
  enableBilling?: boolean;

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
