import type {
  FeedConnectionDisabledCode,
  FeedConnectionDiscordChannelType,
  FeedConnectionMentionType,
  FeedConnectionDiscordWebhookType,
  FeedConnectionDiscordComponentType,
  FeedConnectionDiscordComponentButtonStyle,
  CustomPlaceholderStepType,
} from "../shared/enums";
import type { IFeedEmbed } from "./feed-embed.types";

// Filters
export interface IFilters {
  expression: Record<string, unknown>;
}

// ForumThreadTag
export interface IForumThreadTag {
  id: string;
  filters?: IFilters;
}

// DiscordFormatter
export interface IDiscordFormatter {
  formatTables?: boolean;
  stripImages?: boolean;
  disableImageLinkPreviews?: boolean;
  ignoreNewLines?: boolean;
}

// DiscordWebhook (connection version)
export interface IConnectionDiscordWebhook {
  id: string;
  name?: string;
  iconUrl?: string;
  token: string;
  guildId: string;
  type?: FeedConnectionDiscordWebhookType | null;
  threadId?: string;
  channelId?: string;
  isApplicationOwned?: boolean;
}

// CustomRateLimit
export interface ICustomRateLimit {
  id: string;
  timeWindowSeconds: number;
  limit: number;
}

// CustomPlaceholder steps
export interface ICustomPlaceholderBaseStep {
  id: string;
  type: CustomPlaceholderStepType;
}

export interface ICustomPlaceholderRegexStep extends ICustomPlaceholderBaseStep {
  type: CustomPlaceholderStepType.Regex;
  regexSearch: string;
  regexSearchFlags?: string | null;
  replacementString?: string | null;
}

export interface ICustomPlaceholderUrlEncodeStep extends ICustomPlaceholderBaseStep {
  type: CustomPlaceholderStepType.UrlEncode;
}

export interface ICustomPlaceholderUppercaseStep extends ICustomPlaceholderBaseStep {
  type: CustomPlaceholderStepType.Uppercase;
}

export interface ICustomPlaceholderLowercaseStep extends ICustomPlaceholderBaseStep {
  type: CustomPlaceholderStepType.Lowercase;
}

export interface ICustomPlaceholderDateFormatStep extends ICustomPlaceholderBaseStep {
  type: CustomPlaceholderStepType.DateFormat;
  format: string;
  timezone?: string | null;
  locale?: string | null;
}

export type ICustomPlaceholderStep =
  | ICustomPlaceholderRegexStep
  | ICustomPlaceholderUrlEncodeStep
  | ICustomPlaceholderUppercaseStep
  | ICustomPlaceholderLowercaseStep
  | ICustomPlaceholderDateFormatStep;

export interface ICustomPlaceholder {
  id: string;
  referenceName: string;
  sourcePlaceholder: string;
  steps: ICustomPlaceholderStep[];
}

// Discord component row
export interface IDiscordBaseComponent {
  id: string;
  type: FeedConnectionDiscordComponentType;
}

export interface IDiscordButtonComponent extends IDiscordBaseComponent {
  type: FeedConnectionDiscordComponentType.Button;
  label: string;
  url?: string;
  style: FeedConnectionDiscordComponentButtonStyle;
}

export type IDiscordComponent = IDiscordButtonComponent;

export interface IDiscordComponentRow {
  id: string;
  components?: IDiscordComponent[];
}

// Channel
export interface IChannel {
  id: string;
  type?: FeedConnectionDiscordChannelType | null;
  guildId: string;
  parentChannelId?: string | null;
}

// SplitOptions
export interface ISplitOptions {
  isEnabled?: boolean | null;
  splitChar?: string | null;
  appendChar?: string | null;
  prependChar?: string | null;
}

// PlaceholderLimit
export interface IPlaceholderLimit {
  placeholder: string;
  characterCount: number;
  appendString?: string | null;
}

// MentionTarget
export interface IMentionTarget {
  id: string;
  type: FeedConnectionMentionType;
  filters?: IFilters | null;
}

// Mentions
export interface IMentions {
  targets?: IMentionTarget[] | null;
}

// Details
export interface IConnectionDetails {
  embeds: IFeedEmbed[];
  componentRows?: IDiscordComponentRow[];
  channel?: IChannel;
  channelNewThreadTitle?: string;
  channelNewThreadExcludesPreview?: boolean;
  webhook?: IConnectionDiscordWebhook;
  forumThreadTitle?: string;
  forumThreadTags?: IForumThreadTag[];
  placeholderLimits?: IPlaceholderLimit[];
  content?: string;
  formatter: IDiscordFormatter;
  enablePlaceholderFallback?: boolean;
  componentsV2?: Array<Record<string, unknown>>;
}

// DiscordChannelConnection
export interface IDiscordChannelConnection {
  id: string;
  name: string;
  disabledCode?: FeedConnectionDisabledCode;
  disabledDetail?: string;
  filters?: IFilters;
  rateLimits?: ICustomRateLimit[];
  mentions?: IMentions | null;
  details: IConnectionDetails;
  splitOptions?: ISplitOptions;
  customPlaceholders?: ICustomPlaceholder[];
  createdAt: Date;
  updatedAt: Date;
}

// FeedConnections wrapper
export interface IFeedConnections {
  discordChannels: IDiscordChannelConnection[];
}
