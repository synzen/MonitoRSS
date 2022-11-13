import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Schema as MongooseSchema } from "mongoose";
import { FEED_CONNECTION_DISABLED_CODES } from "../../constants";
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

  @Prop({
    required: true,
  })
  token: string;

  @Prop({
    required: true,
  })
  guildId: string;
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
  _id: false,
  versionKey: false,
  timestamps: false,
})
class Filters {
  @Prop({
    type: MongooseSchema.Types.Mixed,
  })
  expression: Record<string, unknown>;
}

const FiltersSchema = SchemaFactory.createForClass(Filters);

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
    enum: Object.values(FEED_CONNECTION_DISABLED_CODES),
    required: false,
  })
  disabledCode?: string;

  @Prop({
    type: FiltersSchema,
    required: false,
  })
  filters?: Filters;

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
