import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { FeedWebhook, FeedWebhookSchema } from "./feed-webhook.entity";

@Schema({
  _id: false,
})
class FeedEmbedField {
  @Prop({
    isRequired: true,
  })
  name: string;

  @Prop({
    isRequired: true,
  })
  value: string;

  @Prop()
  inline?: boolean;
}

export const FeedEmbedFieldSchema =
  SchemaFactory.createForClass(FeedEmbedField);

@Schema({
  _id: false,
})
export class FeedEmbed {
  @Prop()
  title?: string;

  @Prop()
  description?: string;

  @Prop()
  url?: string;

  @Prop()
  color?: number;

  @Prop()
  footerText?: string;

  @Prop()
  footerIconURL?: string;

  @Prop()
  authorName?: string;

  @Prop()
  authorIconURL?: string;

  @Prop()
  authorURL?: string;

  @Prop()
  thumbnailURL?: string;

  @Prop()
  imageURL?: string;

  @Prop()
  timestamp?: string;

  @Prop({
    type: [FeedEmbedFieldSchema],
    default: [],
  })
  fields?: FeedEmbedField[];

  @Prop({
    type: FeedWebhookSchema,
  })
  webhook?: FeedWebhook;
}

export const FeedEmbedSchema = SchemaFactory.createForClass(FeedEmbed);
