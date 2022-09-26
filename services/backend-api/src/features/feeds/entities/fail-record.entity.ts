import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model } from "mongoose";

@Schema({
  collection: "fail_records",
})
export class FailRecord {
  @Prop({
    type: String,
  })
  _id: string;

  @Prop({
    required: false,
  })
  reason: string;

  @Prop({
    required: true,
    default: Date.now,
  })
  failedAt: Date;

  @Prop({
    required: true,
    default: false,
  })
  alerted: boolean;
}

export type FailRecordDocument = FailRecord & Document;
export type FailRecordModel = Model<FailRecordDocument>;
export const FailRecordSchema = SchemaFactory.createForClass(FailRecord);
export const FailRecordFeature: ModelDefinition = {
  name: FailRecord.name,
  schema: FailRecordSchema,
};
