import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model } from "mongoose";

@Schema({
  collection: "supporters",
})
export class Supporter {
  @Prop({
    required: true,
    type: String,
  })
  _id: string;

  @Prop()
  patron?: boolean;

  @Prop()
  stripe?: boolean;

  @Prop()
  webhook?: boolean;

  @Prop()
  maxGuilds?: number;

  @Prop()
  maxFeeds?: number;

  @Prop()
  maxUserFeeds?: number;

  @Prop({
    type: [String],
    required: true,
  })
  guilds: string[];

  @Prop({
    type: Number,
    required: false,
  })
  maxUserFeedsLegacyAddition?: number;

  @Prop()
  expireAt?: Date;
}

export type SupporterDocument = Supporter & Document;
export type SupporterModel = Model<SupporterDocument>;
export const SupporterSchema = SchemaFactory.createForClass(Supporter);
export const SupporterFeature: ModelDefinition = {
  name: Supporter.name,
  schema: SupporterSchema,
};
