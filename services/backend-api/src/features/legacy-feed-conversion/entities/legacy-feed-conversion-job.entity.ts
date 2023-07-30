import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types, Model, Schema as MongooseSchema } from "mongoose";
import { LegacyFeedConversionStatus } from "../constants/legacy-feed-conversion-status.constants";

@Schema({
  collection: "legacyfeedconversionjob",
  timestamps: true,
})
export class LegacyFeedConversionJob {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
  })
  legacyFeedId: Types.ObjectId;

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

  @Prop({
    required: false,
    type: String,
  })
  failReasonPublic?: string;

  @Prop({
    required: false,
    type: String,
  })
  failReasonInternal?: string;

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
