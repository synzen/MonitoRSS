import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema, Types } from "mongoose";
import { UserFeedManagerStatus } from "../../user-feed-management-invites/constants";

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

  createdAt: Date;
  updatedAt: Date;
}

const UserFeedShareUserSchema = SchemaFactory.createForClass(
  UserFeedUserShareManageUser
);

@Schema({
  timestamps: false,
  _id: false,
})
export class UserFeedShareManageOptions {
  @Prop({
    required: true,
    type: [UserFeedShareUserSchema],
  })
  users: UserFeedUserShareManageUser[];
}

export const UserFeedShareManageOptionsSchema = SchemaFactory.createForClass(
  UserFeedShareManageOptions
);
