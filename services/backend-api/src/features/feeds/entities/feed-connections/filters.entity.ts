import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Schema as MongooseSchema } from "mongoose";

@Schema({
  _id: false,
  versionKey: false,
  timestamps: false,
})
export class Filters {
  @Prop({
    type: MongooseSchema.Types.Mixed,
  })
  expression: Record<string, unknown>;
}

export const FiltersSchema = SchemaFactory.createForClass(Filters);
