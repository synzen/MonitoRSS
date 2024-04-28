import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({
  _id: false,
  timestamps: false,
  versionKey: false,
})
export class ExternalFeedProperty {
  @Prop({
    required: true,
    default: () => new Types.ObjectId().toHexString(),
  })
  id: string;

  @Prop({
    required: true,
  })
  sourceField: string;

  @Prop({
    required: true,
  })
  cssSelector: string;

  @Prop({
    required: true,
  })
  label: string;
}

export const ExternalFeedPropertySchema =
  SchemaFactory.createForClass(ExternalFeedProperty);
