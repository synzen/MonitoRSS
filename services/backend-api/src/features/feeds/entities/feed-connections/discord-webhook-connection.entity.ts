import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Schema as MongooseSchema } from "mongoose";
import { FeedEmbed, FeedEmbedSchema } from "../feed-embed.entity";

@Schema({
  _id: false,
  versionKey: false,
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

const WebhookSchema = SchemaFactory.createForClass(Webhook);

@Schema({
  _id: false,
  timestamps: false,
  versionKey: false,
})
class Details {
  @Prop({
    type: [FeedEmbedSchema],
    default: [],
  })
  embeds: FeedEmbed[];

  @Prop({
    type: WebhookSchema,
    required: true,
  })
  webhook: Webhook;

  @Prop({
    type: String,
    required: false,
  })
  content?: string;
}

const DetailsSchema = SchemaFactory.createForClass(Details);

@Schema({
  versionKey: false,
  timestamps: true,
  _id: false,
})
export class DiscordWebhookConnection {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  id: Types.ObjectId;

  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    type: DetailsSchema,
    required: true,
  })
  details: Details;

  createdAt: Date;
  updatedAt: Date;
}

export const DiscordWebhookConnectionSchema = SchemaFactory.createForClass(
  DiscordWebhookConnection
);
