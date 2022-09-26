import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model } from "mongoose";

@Schema({
  collection: "banned_feeds",
})
export class BannedFeed {
  @Prop({ required: true })
  url: string;

  @Prop()
  reason?: string;

  @Prop({
    type: [String],
    default: [],
  })
  guildIds: string[];
}

export type BannedFeedDocument = BannedFeed & Document;
export type BannedFeedModel = Model<BannedFeedDocument>;
export const BannedFeedSchema = SchemaFactory.createForClass(BannedFeed);
export const BannedFeedFeature: ModelDefinition = {
  name: BannedFeed.name,
  schema: BannedFeedSchema,
};
