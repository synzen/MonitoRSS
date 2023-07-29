import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types, Model } from "mongoose";
import { LegacyFeedConversionStatus } from "../constants/legacy-feed-conversion-status.constants";

@Schema({
  collection: "legacyfeedconversionjob",
  timestamps: true,
})
export class LegacyFeedConversionJob {
  _id: Types.ObjectId;

  @Prop({
    required: true,
  })
  legacyFeedId: string;

  @Prop({
    required: true,
  })
  guildId: string;

  @Prop({
    required: true,
  })
  discordUserId: string;

  @Prop({
    required: true,
    default: LegacyFeedConversionStatus.NotStarted,
    enum: Object.values(LegacyFeedConversionStatus),
    type: String,
  })
  status: LegacyFeedConversionStatus;

  createdAt: Date;

  updatedAt: Date;
}

export type LegacyFeedConversionJobDocument = LegacyFeedConversionJob &
  Document;
export type LegacyFeedConversionJobModel =
  Model<LegacyFeedConversionJobDocument>;
export const LegacyFeedConversionJobSchema = SchemaFactory.createForClass(
  LegacyFeedConversionJob
);
export const LegacyFeedConversionJobFeature: ModelDefinition = {
  name: LegacyFeedConversionJob.name,
  schema: LegacyFeedConversionJobSchema,
};
