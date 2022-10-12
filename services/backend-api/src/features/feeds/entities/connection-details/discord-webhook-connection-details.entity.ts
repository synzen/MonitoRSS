import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { FeedEmbed, FeedEmbedSchema } from "../feed-embed.entity";

@Schema({
  _id: false,
  timestamps: false,
})
class Webhook {
  @Prop({
    required: true,
  })
  id: string;

  @Prop({
    required: false,
  })
  name?: string;

  @Prop({
    required: false,
  })
  iconUrl?: string;
}

@Schema({
  timestamps: false,
  _id: false,
})
export class DiscordWebhookConnectionDetails {
  @Prop({
    type: [FeedEmbedSchema],
    default: [],
  })
  embeds: FeedEmbed[];

  @Prop({
    type: Webhook,
    required: true,
  })
  webhook: Webhook;

  @Prop({
    type: String,
    required: false,
  })
  content?: string;
}

export const DiscordWebhookConnectionDetailsSchema =
  SchemaFactory.createForClass(DiscordWebhookConnectionDetails);
