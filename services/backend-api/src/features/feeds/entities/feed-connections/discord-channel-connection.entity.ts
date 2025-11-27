import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Schema as MongooseSchema } from "mongoose";
import {
  FeedConnectionDisabledCode,
  FeedConnectionDiscordChannelType,
  FeedConnectionDiscordComponentType,
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
  DiscordComponentRow,
  DiscordComponentRowSchema,
} from "./discord-component-row.entity";
import {
  DiscordFormatter,
  DiscordFormatterSchema,
} from "./discord-formatter.entity";
import { DiscordWebhook, DiscordWebhookSchema } from "./discord-webhook.entity";
import { Filters, FiltersSchema } from "./filters.entity";
import {
  ForumThreadTag,
  ForumThreadTagSchema,
} from "./forum-thread-tag.entity";
import {
  DiscordActionRowV2,
  DiscordActionRowV2Schema,
  DiscordComponentV2BaseSchema,
  DiscordSectionV2,
  DiscordSectionV2Schema,
} from "./discord-components-v2.entity";

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
  _id: false,
  timestamps: false,
  versionKey: false,
})
class Channel {
  @Prop({
    required: true,
  })
  id: string;

  @Prop({
    enum: Object.values(FeedConnectionDiscordChannelType),
    required: false,
    type: String,
  })
  type?: FeedConnectionDiscordChannelType | null;

  @Prop({
    required: true,
  })
  guildId: string;

  // If the channel is a thread, this is the ID of the parent channel. Otherwise it is undefined.
  @Prop({
    required: false,
    type: String,
  })
  parentChannelId?: string | null;
}

const ChannelSchema = SchemaFactory.createForClass(Channel);

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
  versionKey: false,
  timestamps: false,
})
class Details {
  @Prop({
    type: [FeedEmbedSchema],
    default: [],
  })
  embeds: FeedEmbed[];

  @Prop({
    type: [DiscordComponentRowSchema],
    default: [],
    validate: [
      function (this: Array<DiscordComponentRow>) {
        return this.length ? this.length <= 5 : true;
      },
      "Discord component rows cannot have more than 5 components",
    ],
  })
  componentRows?: DiscordComponentRow[];

  @Prop({
    type: ChannelSchema,
    required: false,
  })
  channel?: Channel;

  @Prop({
    required: false,
  })
  channelNewThreadTitle?: string;

  @Prop({
    required: false,
  })
  channelNewThreadExcludesPreview?: boolean;

  @Prop({
    type: DiscordWebhookSchema,
    required: false,
  })
  webhook?: DiscordWebhook;

  @Prop({
    required: false,
  })
  forumThreadTitle?: string;

  @Prop({
    type: [ForumThreadTagSchema],
    required: false,
    default: [],
  })
  forumThreadTags?: ForumThreadTag[];

  @Prop({
    type: [PlaceholderLimitSchema],
    required: false,
    default: [],
  })
  placeholderLimits?: PlaceholderLimit[];

  @Prop({
    type: String,
    required: false,
  })
  content?: string;

  @Prop({
    type: DiscordFormatterSchema,
    required: true,
    default: {},
  })
  formatter: DiscordFormatter;

  @Prop({
    required: false,
    type: Boolean,
  })
  enablePlaceholderFallback?: boolean;

  @Prop({
    type: [DiscordComponentV2BaseSchema],
    default: null,
    validate: [
      (arr: Array<DiscordSectionV2 | DiscordActionRowV2>) =>
        !arr || arr.length <= 10,
      "Cannot have more than 10 top-level V2 components",
    ],
  })
  componentsV2?: Array<DiscordSectionV2 | DiscordActionRowV2> | null;
}

const DetailsSchema = SchemaFactory.createForClass(Details);

@Schema({
  _id: false,
  timestamps: true,
  versionKey: false,
})
export class DiscordChannelConnection {
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
    required: false,
    type: String,
  })
  disabledDetail?: string;

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

export const DiscordChannelConnectionSchema = SchemaFactory.createForClass(
  DiscordChannelConnection
);

// In the module or after DetailsSchema is created
DetailsSchema.path<MongooseSchema.Types.DocumentArray>(
  "componentsV2"
).discriminator(
  FeedConnectionDiscordComponentType.Section,
  DiscordSectionV2Schema
);
DetailsSchema.path<MongooseSchema.Types.DocumentArray>(
  "componentsV2"
).discriminator(
  FeedConnectionDiscordComponentType.ActionRow,
  DiscordActionRowV2Schema
);
