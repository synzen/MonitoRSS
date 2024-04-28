import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({
  _id: false,
  timestamps: false,
  versionKey: false,
})
export class ExternalFeedPropertySelector {
  @Prop({
    required: true,
    default: () => new Types.ObjectId().toHexString(),
  })
  id: string;

  @Prop({
    required: true,
  })
  label: string;

  @Prop({
    required: true,
  })
  cssSelector: string;
}

export const ExternalFeedPropertyFieldSchema = SchemaFactory.createForClass(
  ExternalFeedPropertySelector
);

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
    type: [ExternalFeedPropertyFieldSchema],
  })
  selectors: ExternalFeedPropertySelector[];
}

export const ExternalFeedPropertySchema =
  SchemaFactory.createForClass(ExternalFeedProperty);
