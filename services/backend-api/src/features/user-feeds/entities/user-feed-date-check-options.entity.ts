import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({
  timestamps: false,
  _id: false,
})
export class UserFeedDateCheckOptions {
  @Prop({
    required: false,
    type: Number,
  })
  oldArticleDateDiffMsThreshold?: number;
}

export const UserFeedDateCheckOptionsSchema = SchemaFactory.createForClass(
  UserFeedDateCheckOptions
);
