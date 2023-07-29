import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model } from "mongoose";

@Schema({
  collection: "userfeedlimitoverride",
})
export class UserFeedLimitOverride {
  @Prop({
    required: true,
    type: String,
  })
  _id: string;

  @Prop({
    required: true,
    type: Number,
    default: 0,
  })
  additionalUserFeeds: number;
}

export type UserFeedLimitOverrideDocument = UserFeedLimitOverride & Document;
export type UserFeedLimitOverrideModel = Model<UserFeedLimitOverrideDocument>;
export const UserFeedLimitOverrideSchema = SchemaFactory.createForClass(
  UserFeedLimitOverride
);
export const UserFeedLimitOverrideFeature: ModelDefinition = {
  name: UserFeedLimitOverride.name,
  schema: UserFeedLimitOverrideSchema,
};
