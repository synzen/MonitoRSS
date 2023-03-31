import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Schema as MongooseSchema } from "mongoose";
import { FeedConnectionDisabledCode } from "../../constants";
import { FeedEmbed, FeedEmbedSchema } from "../feed-embed.entity";
import {
  DiscordFormatter,
  DiscordFormatterSchema,
} from "./discord-formatter.entity";

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
  timestamps: false,
  _id: false,
})
class SplitOptions {
  @Prop({
    required: false,
    default: null,
    type: String,
  })
  splitChar?: string | null;

  @Prop({
    required: false,
    default: null,
    type: String,
  })
  appendChar?: string | null;

  @Prop({
    required: false,
    default: null,
    type: String,
  })
  prependChar?: string | null;
}

const SplitOptionsSchema = SchemaFactory.createForClass(SplitOptions);

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

  @Prop({
    type: DiscordFormatterSchema,
    required: false,
  })
  formatter?: DiscordFormatter;
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
    enum: Object.values(FeedConnectionDisabledCode),
    required: false,
  })
  disabledCode?: FeedConnectionDisabledCode;

  @Prop({
    type: FiltersSchema,
    required: false,
  })
  filters?: Filters;

  @Prop({
    type: DetailsSchema,
    required: true,
    default: {},
  })
  details: Details;

  @Prop({
    required: false,
    schema: SplitOptionsSchema,
  })
  splitOptions?: SplitOptions;

  createdAt: Date;
  updatedAt: Date;
}

export const DiscordWebhookConnectionSchema = SchemaFactory.createForClass(
  DiscordWebhookConnection
);
