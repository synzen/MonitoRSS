import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({
  timestamps: false,
  _id: false,
})
export class UserFeedUser {
  @Prop({
    required: false,
  })
  id?: Types.ObjectId;

  @Prop({
    required: true,
  })
  discordUserId: string;
}

export const UserFeedUserSchema = SchemaFactory.createForClass(UserFeedUser);
