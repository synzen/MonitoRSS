import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model } from "mongoose";

@Schema({
  collection: "schedules",
})
export class FeedSchedule {
  @Prop({
    unique: true,
  })
  name: string;

  @Prop({
    type: [String],
    default: [],
  })
  keywords: string[];

  @Prop({
    type: [String],
    default: [],
  })
  feeds: string[];

  @Prop({
    required: true,
  })
  refreshRateMinutes: number;
}

export type FeedScheduleDocument = FeedSchedule & Document;
export type FeedScheduleModel = Model<FeedScheduleDocument>;
export const FeedScheduleSchema = SchemaFactory.createForClass(FeedSchedule);
export const FeedScheduleFeature: ModelDefinition = {
  name: FeedSchedule.name,
  schema: FeedScheduleSchema,
};
