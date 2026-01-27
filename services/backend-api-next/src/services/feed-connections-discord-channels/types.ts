import type { Config } from "../../config";
import type {
  IUserFeed,
  IUserFeedRepository,
} from "../../repositories/interfaces/user-feed.types";
import type {
  IDiscordChannelConnection,
  ICustomPlaceholder,
  ICustomRateLimit,
  IMentions,
  ISplitOptions,
  IFilters,
  IDiscordFormatter,
  IPlaceholderLimit,
  IDiscordComponentRow,
  IForumThreadTag,
} from "../../repositories/interfaces/feed-connection.types";
import type { IFeedEmbed } from "../../repositories/interfaces/feed-embed.types";
import type {
  FeedConnectionDisabledCode,
} from "../../repositories/shared/enums";
import type { FeedsService } from "../feeds/feeds.service";
import type { FeedHandlerService } from "../feed-handler/feed-handler.service";
import type { SupportersService } from "../supporters/supporters.service";
import type { DiscordWebhooksService } from "../discord-webhooks/discord-webhooks.service";
import type { DiscordApiService } from "../discord-api/discord-api.service";
import type { DiscordAuthService } from "../discord-auth/discord-auth.service";
import type { UserFeedConnectionEventsService } from "../user-feed-connection-events/user-feed-connection-events.service";
import type { UsersService } from "../users/users.service";

export enum CopyableSetting {
  Embeds = "embeds",
  WebhookName = "webhookName",
  WebhookIconUrl = "webhookIconUrl",
  WebhookThread = "webhookThread",
  PlaceholderLimits = "placeholderLimits",
  Content = "content",
  ContentFormatTables = "contentFormatTables",
  ContentStripImages = "contentStripImages",
  IgnoreNewLines = "ignoreNewLines",
  ContentDisableImageLinkPreviews = "contentDisableImageLinkPreviews",
  Components = "components",
  ComponentsV2 = "componentsV2",
  ForumThreadTitle = "forumThreadTitle",
  ForumThreadTags = "forumThreadTags",
  placeholderFallbackSetting = "placeholderFallbackSetting",
  Filters = "filters",
  SplitOptions = "splitOptions",
  CustomPlaceholders = "customPlaceholders",
  DeliveryRateLimits = "deliveryRateLimits",
  MessageMentions = "messageMentions",
  Channel = "channel",
}

export interface CreateDiscordChannelConnectionInput {
  feed: IUserFeed;
  name: string;
  channelId?: string;
  webhook?: {
    id: string;
    name?: string;
    iconUrl?: string;
    threadId?: string;
  };
  applicationWebhook?: {
    channelId: string;
    name: string;
    iconUrl?: string;
    threadId?: string;
  };
  userAccessToken: string;
  userDiscordUserId: string;
  threadCreationMethod?: "new-thread";
  templateData?: {
    content?: string;
    embeds?: IFeedEmbed[];
    componentsV2?: Array<Record<string, unknown>>;
    placeholderLimits?: IPlaceholderLimit[];
    formatter?: IDiscordFormatter;
  };
}

export interface UpdateDiscordChannelConnectionDetailsInput {
  channel?: { id: string };
  channelNewThreadExcludesPreview?: boolean;
  channelNewThreadTitle?: string;
  webhook?: {
    id: string;
    name?: string;
    iconUrl?: string;
    threadId?: string;
  };
  applicationWebhook?: {
    channelId: string;
    name: string;
    iconUrl?: string;
    threadId?: string;
  };
  embeds?: IFeedEmbed[];
  content?: string;
  forumThreadTitle?: string;
  forumThreadTags?: IForumThreadTag[];
  placeholderLimits?: IPlaceholderLimit[];
  componentRows?: IDiscordComponentRow[];
  componentsV2?: Array<Record<string, unknown>>;
  formatter?: IDiscordFormatter;
  enablePlaceholderFallback?: boolean;
}

export interface UpdateDiscordChannelConnectionInput {
  accessToken: string;
  feed: {
    user: { discordUserId: string };
    connections: IUserFeed["connections"];
  };
  oldConnection: IDiscordChannelConnection;
  updates: {
    filters?: IFilters | null;
    name?: string;
    threadCreationMethod?: "new-thread" | null;
    disabledCode?: FeedConnectionDisabledCode | null;
    splitOptions?: ISplitOptions | null;
    mentions?: IMentions | null;
    rateLimits?: ICustomRateLimit[] | null;
    customPlaceholders?: ICustomPlaceholder[] | null;
    details?: UpdateDiscordChannelConnectionDetailsInput;
  };
}

export interface CloneConnectionInput {
  name: string;
  channelId?: string;
  targetFeedIds?: string[];
  targetFeedSelectionType?: UserFeedTargetFeedSelectionType;
  targetFeedSearch?: string;
}

export enum UserFeedTargetFeedSelectionType {
  Selected = "selected",
  All = "all",
}

export interface CopySettingsInput {
  properties: CopyableSetting[];
  targetDiscordChannelConnectionIds: string[];
}

export interface FeedConnectionsDiscordChannelsServiceDeps {
  config: Config;
  feedsService: FeedsService;
  userFeedRepository: IUserFeedRepository;
  feedHandlerService: FeedHandlerService;
  supportersService: SupportersService;
  discordWebhooksService: DiscordWebhooksService;
  discordApiService: DiscordApiService;
  discordAuthService: DiscordAuthService;
  connectionEventsService: UserFeedConnectionEventsService;
  usersService: UsersService;
}
