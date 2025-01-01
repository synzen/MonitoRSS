import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types, Model } from "mongoose";

@Schema({
  timestamps: true,
  autoIndex: true,
})
export class UserFeedTag {
  _id: Types.ObjectId;

  @Prop({
    required: true,
  })
  label: string;

  createdAt: Date;
  updatedAt: Date;
}

export type UserFeedTagDocument = UserFeedTag & Document;
export type UserFeedTagModel = Model<UserFeedTagDocument>;

export const UserFeedTagSchema = SchemaFactory.createForClass(UserFeedTag);

export const UserFeedTagFeature: ModelDefinition = {
  name: UserFeedTag.name,
  schema: UserFeedTagSchema,
};
