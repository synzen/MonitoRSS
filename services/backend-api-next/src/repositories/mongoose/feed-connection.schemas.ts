import { Schema, Types, type InferSchemaType } from "mongoose";
import {
  FeedConnectionDisabledCode,
  FeedConnectionDiscordChannelType,
  FeedConnectionDiscordComponentButtonStyle,
  FeedConnectionDiscordComponentType,
  FeedConnectionDiscordWebhookType,
  FeedConnectionMentionType,
  CustomPlaceholderStepType,
} from "../shared/enums";
import { FeedEmbedSchema } from "./feed-embed.schemas";

// Filters
export const FiltersSchema = new Schema(
  {
    expression: { type: Schema.Types.Mixed },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// ForumThreadTag
export const ForumThreadTagSchema = new Schema(
  {
    id: { type: String, required: true },
    filters: { type: FiltersSchema },
  },
  { _id: false, timestamps: false }
);

// DiscordFormatter
export const DiscordFormatterSchema = new Schema(
  {
    formatTables: { type: Boolean, default: false },
    stripImages: { type: Boolean, default: false },
    disableImageLinkPreviews: { type: Boolean, default: false },
    ignoreNewLines: { type: Boolean, default: false },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// DiscordWebhook (connection version)
export const ConnectionDiscordWebhookSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String },
    iconUrl: { type: String },
    token: { type: String, required: true },
    guildId: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(FeedConnectionDiscordWebhookType),
    },
    threadId: { type: String },
    channelId: { type: String },
    isApplicationOwned: { type: Boolean },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// CustomRateLimit
export const CustomRateLimitSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      default: () => new Types.ObjectId().toHexString(),
    },
    timeWindowSeconds: { type: Number, required: true },
    limit: { type: Number, required: true },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// CustomPlaceholder base step
const CustomPlaceholderBaseStepSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      default: () => new Types.ObjectId().toHexString(),
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(CustomPlaceholderStepType),
    },
  },
  { discriminatorKey: "type", _id: false, versionKey: false, timestamps: false }
);

// CustomPlaceholder step discriminator schemas
const CustomPlaceholderRegexStepSchema = new Schema(
  {
    regexSearch: { type: String, required: true },
    regexSearchFlags: { type: String },
    replacementString: { type: String },
  },
  { _id: false, versionKey: false, timestamps: false }
);

const CustomPlaceholderUrlEncodeStepSchema = new Schema(
  {},
  { _id: false, versionKey: false, timestamps: false }
);

const CustomPlaceholderUppercaseStepSchema = new Schema(
  {},
  { _id: false, versionKey: false, timestamps: false }
);

const CustomPlaceholderLowercaseStepSchema = new Schema(
  {},
  { _id: false, versionKey: false, timestamps: false }
);

const CustomPlaceholderDateFormatStepSchema = new Schema(
  {
    format: { type: String, required: true },
    timezone: { type: String },
    locale: { type: String },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// CustomPlaceholder
export const CustomPlaceholderSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      default: () => new Types.ObjectId().toHexString(),
    },
    referenceName: { type: String, required: true },
    sourcePlaceholder: { type: String, required: true },
    steps: { type: [CustomPlaceholderBaseStepSchema], required: true },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// Apply discriminators for CustomPlaceholder steps
const stepsArray = CustomPlaceholderSchema.path(
  "steps"
) as Schema.Types.DocumentArray;
stepsArray.discriminator(
  CustomPlaceholderStepType.Regex,
  CustomPlaceholderRegexStepSchema
);
stepsArray.discriminator(
  CustomPlaceholderStepType.UrlEncode,
  CustomPlaceholderUrlEncodeStepSchema
);
stepsArray.discriminator(
  CustomPlaceholderStepType.Uppercase,
  CustomPlaceholderUppercaseStepSchema
);
stepsArray.discriminator(
  CustomPlaceholderStepType.Lowercase,
  CustomPlaceholderLowercaseStepSchema
);
stepsArray.discriminator(
  CustomPlaceholderStepType.DateFormat,
  CustomPlaceholderDateFormatStepSchema
);

// Discord component base
const DiscordBaseComponentSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: Number,
      required: true,
      enum: Object.values(FeedConnectionDiscordComponentType),
    },
  },
  { discriminatorKey: "type", _id: false, versionKey: false, timestamps: false }
);

// Discord button component
const DiscordButtonComponentSchema = new Schema(
  {
    label: { type: String, required: true },
    url: { type: String },
    style: {
      type: Number,
      required: true,
      min: FeedConnectionDiscordComponentButtonStyle.Primary,
      max: FeedConnectionDiscordComponentButtonStyle.Link,
    },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// DiscordComponentRow
export const DiscordComponentRowSchema = new Schema(
  {
    id: { type: String, required: true },
    components: { type: [DiscordBaseComponentSchema] },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// Apply discriminator for DiscordComponentRow components
const componentsArray = DiscordComponentRowSchema.path(
  "components"
) as Schema.Types.DocumentArray;
componentsArray.discriminator(
  FeedConnectionDiscordComponentType.Button,
  DiscordButtonComponentSchema
);

// Channel
const ChannelSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(FeedConnectionDiscordChannelType),
    },
    guildId: { type: String, required: true },
    parentChannelId: { type: String },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// SplitOptions
const SplitOptionsSchema = new Schema(
  {
    isEnabled: { type: Boolean, default: false },
    splitChar: { type: String, default: null },
    appendChar: { type: String, default: null },
    prependChar: { type: String, default: null },
  },
  { _id: false, timestamps: false }
);

// PlaceholderLimit
const PlaceholderLimitSchema = new Schema(
  {
    placeholder: { type: String, required: true },
    characterCount: { type: Number, required: true },
    appendString: { type: String },
  },
  { _id: false, timestamps: false }
);

// MentionTarget
const MentionTargetSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(FeedConnectionMentionType),
    },
    filters: { type: FiltersSchema },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// Mentions
const MentionsSchema = new Schema(
  {
    targets: { type: [MentionTargetSchema] },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// Details
const DetailsSchema = new Schema(
  {
    embeds: { type: [FeedEmbedSchema], default: [] },
    componentRows: { type: [DiscordComponentRowSchema], default: [] },
    channel: { type: ChannelSchema },
    channelNewThreadTitle: { type: String },
    channelNewThreadExcludesPreview: { type: Boolean },
    webhook: { type: ConnectionDiscordWebhookSchema },
    forumThreadTitle: { type: String },
    forumThreadTags: { type: [ForumThreadTagSchema], default: [] },
    placeholderLimits: { type: [PlaceholderLimitSchema], default: [] },
    content: { type: String },
    formatter: { type: DiscordFormatterSchema, required: true, default: {} },
    enablePlaceholderFallback: { type: Boolean },
    componentsV2: { type: Schema.Types.Mixed },
  },
  { _id: false, versionKey: false, timestamps: false }
);

// DiscordChannelConnection
export const DiscordChannelConnectionSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, default: () => new Types.ObjectId() },
    name: { type: String, required: true },
    disabledCode: {
      type: String,
      enum: Object.values(FeedConnectionDisabledCode),
    },
    disabledDetail: { type: String },
    filters: { type: FiltersSchema },
    rateLimits: { type: [CustomRateLimitSchema] },
    mentions: { type: MentionsSchema },
    details: { type: DetailsSchema, required: true },
    splitOptions: { type: SplitOptionsSchema },
    customPlaceholders: { type: [CustomPlaceholderSchema] },
  },
  { _id: false, timestamps: true, versionKey: false }
);

// FeedConnections wrapper
export const FeedConnectionsSchema = new Schema(
  {
    discordChannels: { type: [DiscordChannelConnectionSchema], default: [] },
  },
  { _id: false, timestamps: false, versionKey: false }
);

// Exported types derived from schemas
export type DiscordChannelConnectionDoc = InferSchemaType<
  typeof DiscordChannelConnectionSchema
>;
