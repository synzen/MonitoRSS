import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types, Model, Schema as MongooseSchema } from "mongoose";

@Schema({
  timestamps: true,
  autoIndex: true,
  collection: "user_feed_tags",
})
export class UserFeedTag {
  _id: Types.ObjectId;

  @Prop({
    required: true,
  })
  label: string;

  @Prop({
    type: String,
  })
  color?: string;

  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    required: true,
    index: true,
  })
  feedIds: Types.ObjectId[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

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
