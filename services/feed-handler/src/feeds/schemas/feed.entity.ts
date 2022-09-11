import { Prop, Schema, SchemaFactory, ModelDefinition } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type FeedDocument = Feed & Document;

@Schema()
export class Feed {
  @Prop({
    required: false,
  })
  disabled?: string;

  @Prop({
    required: true,
  })
  url: string;
}

export const FeedSchema = SchemaFactory.createForClass(Feed);
export const FeedFeature: ModelDefinition = {
  name: Feed.name,
  schema: FeedSchema,
};
