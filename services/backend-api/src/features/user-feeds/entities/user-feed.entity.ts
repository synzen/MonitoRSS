import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types, Model } from "mongoose";
import {
  FeedConnections,
  FeedConnectionSchema,
} from "../../feeds/entities/feed-connections.entity";
import { UserFeedDisabledCode, UserFeedHealthStatus } from "../types";
import { UserFeedUser, UserFeedUserSchema } from "./user-feed-user.entity";

@Schema({
  timestamps: true,
})
export class UserFeed {
  _id: Types.ObjectId;

  @Prop({
    required: true,
  })
  title: string;

  @Prop({
    required: true,
  })
  url: string;

  @Prop({
    enum: Object.values(UserFeedDisabledCode),
    required: false,
  })
  disabledCode?: UserFeedDisabledCode;

  @Prop({
    enum: Object.values(UserFeedHealthStatus),
    required: true,
    default: UserFeedHealthStatus.Ok,
  })
  healthStatus: UserFeedHealthStatus;

  @Prop({
    type: FeedConnectionSchema,
    required: false,
    default: {},
  })
  connections: FeedConnections;

  @Prop({
    required: true,
    schema: UserFeedUserSchema,
  })
  user: UserFeedUser;

  createdAt: Date;
  updatedAt: Date;
}

export type UserFeedDocument = UserFeed & Document;
export type UserFeedModel = Model<UserFeedDocument>;
export const UserFeedSchema = SchemaFactory.createForClass(UserFeed);
export const UserFeedFeature: ModelDefinition = {
  name: UserFeed.name,
  schema: UserFeedSchema,
};
