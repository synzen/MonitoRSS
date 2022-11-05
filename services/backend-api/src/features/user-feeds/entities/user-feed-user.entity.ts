import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({
  timestamps: false,
  _id: false,
})
export class UserFeedUser {
  @Prop({
    required: true,
  })
  discordUserId: string;
}

export const UserFeedUserSchema = SchemaFactory.createForClass(UserFeedUser);
