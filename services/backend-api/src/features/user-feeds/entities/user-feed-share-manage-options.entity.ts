import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({
  timestamps: false,
  _id: false,
})
export class UserFeedUserShareManageUser {
  @Prop({
    required: true,
  })
  discordUserId: string;
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
