import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Schema as MongooseSchema } from "mongoose";
import {
  FeedConnectionDisabledCode,
  FeedConnectionDiscordWebhookType,
  FeedConnectionMentionType,
} from "../../constants";
import { FeedEmbed, FeedEmbedSchema } from "../feed-embed.entity";
import {
  CustomPlaceholder,
  CustomPlaceholderSchema,
} from "./custom-placeholder.entity";
import {
  CustomRateLimit,
  CustomRateLimitSchema,
} from "./custom-rate-limit.entity";
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

  @Prop({
    required: false,
    enum: Object.values(FeedConnectionDiscordWebhookType),
    type: String,
  })
  type?: FeedConnectionDiscordWebhookType | null;
}

const WebhookSchema = SchemaFactory.createForClass(Webhook);

@Schema({
  timestamps: false,
  _id: false,
})
class SplitOptions {
  @Prop({
    required: false,
    default: false,
    type: Boolean,
  })
  isEnabled?: boolean | null;

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
  timestamps: false,
  _id: false,
})
class PlaceholderLimit {
  @Prop({
    required: true,
  })
  placeholder: string;

  @Prop({
    required: true,
  })
  characterCount: number;

  @Prop({
    required: false,
    type: String,
  })
  appendString?: string | null;
}

const PlaceholderLimitSchema = SchemaFactory.createForClass(PlaceholderLimit);

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

  @Prop({
    required: false,
  })
  forumThreadTitle?: string;

  @Prop({
    type: [PlaceholderLimitSchema],
    required: false,
    default: [],
  })
  placeholderLimits?: PlaceholderLimit[];

  @Prop({
    required: false,
    type: Boolean,
  })
  enablePlaceholderFallback?: boolean;
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
  _id: false,
  timestamps: false,
  versionKey: false,
})
class MentionTarget {
  @Prop({
    required: true,
  })
  id: string;

  @Prop({
    enum: Object.values(FeedConnectionMentionType),
    required: true,
    type: String,
  })
  type: FeedConnectionMentionType;

  @Prop({
    required: false,
    type: FiltersSchema,
  })
  filters?: Filters | null;
}

const MentionTargetSchema = SchemaFactory.createForClass(MentionTarget);

@Schema({
  _id: false,
  timestamps: false,
  versionKey: false,
})
class Mentions {
  @Prop({
    required: false,
    type: [MentionTargetSchema],
  })
  targets?: MentionTarget[] | null;
}

const MentionsSchema = SchemaFactory.createForClass(Mentions);

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
    type: [CustomRateLimitSchema],
    required: false,
  })
  rateLimits?: CustomRateLimit[];

  @Prop({
    type: MentionsSchema,
    required: false,
  })
  mentions?: Mentions | null;

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

  @Prop({
    required: false,
    type: [CustomPlaceholderSchema],
  })
  customPlaceholders?: CustomPlaceholder[];

  createdAt: Date;
  updatedAt: Date;
}

export const DiscordWebhookConnectionSchema = SchemaFactory.createForClass(
  DiscordWebhookConnection
);
