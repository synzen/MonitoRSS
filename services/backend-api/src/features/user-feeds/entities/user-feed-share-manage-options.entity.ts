import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";
import {
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../../user-feed-management-invites/constants";

@Schema({
  _id: false,
  timestamps: true,
})
export class UserFeedUserShareManageUser {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    auto: true,
  })
  id: Types.ObjectId;

  @Prop({
    required: false,
    type: String,
    enum: Object.values(UserFeedManagerInviteType),
    default: UserFeedManagerInviteType.CoManage,
  })
  type: UserFeedManagerInviteType;

  @Prop({
    required: true,
  })
  discordUserId: string;

  @Prop({
    required: true,
    enum: Object.values(UserFeedManagerStatus),
    default: UserFeedManagerStatus.Pending,
    type: String,
  })
  status: UserFeedManagerStatus;

  @Prop({
    required: false,
    type: [MongooseSchema.Types.ObjectId],
  })
  connectionIds?: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

const UserFeedShareInviteSchema = SchemaFactory.createForClass(
  UserFeedUserShareManageUser
);

@Schema({
  timestamps: false,
  _id: false,
})
export class UserFeedShareManageOptions {
  @Prop({
    required: true,
    type: [UserFeedShareInviteSchema],
  })
  invites: UserFeedUserShareManageUser[];
}

export const UserFeedShareManageOptionsSchema = SchemaFactory.createForClass(
  UserFeedShareManageOptions
);
