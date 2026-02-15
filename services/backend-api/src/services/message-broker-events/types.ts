import type { IFeedConnections } from "../../repositories/interfaces/feed-connection.types";
import type {
  IUserFeedDateCheckOptions,
  IUserFeedFormatOptions,
  IExternalFeedProperty,
} from "../../repositories/interfaces/user-feed.types";

export interface DiscordMediumEventDetails {
  channelNewThreadTitle?: string;
  channelNewThreadExcludesPreview?: boolean;
  guildId: string;
  channel?: {
    id: string;
    type?: string | null;
    guildId: string;
  };
  webhook?: {
    id: string;
    token: string;
    name?: string;
    iconUrl?: string;
    type?: string | null;
    threadId?: string;
  };
  content: string;
  embeds: Array<Record<string, unknown>>;
  components: Array<Record<string, unknown>>;
  componentsV2?: Array<Record<string, unknown>>;
  forumThreadTitle?: string;
  forumThreadTags?: Array<{
    id: string;
    filters?: { expression: Record<string, unknown> };
  }>;
  mentions?: {
    targets?: Array<{
      id: string;
      type: string;
      filters?: { expression: Record<string, unknown> } | null;
    }> | null;
  } | null;
  customPlaceholders?: Array<Record<string, unknown>>;
  formatter: {
    formatTables?: boolean;
    stripImages?: boolean;
    disableImageLinkPreviews?: boolean;
    ignoreNewLines?: boolean;
    connectionCreatedAt?: string;
  };
  splitOptions?: {
    isEnabled?: boolean | null;
    splitChar?: string | null;
    appendChar?: string | null;
    prependChar?: string | null;
  };
  placeholderLimits?: Array<{
    placeholder: string;
    characterCount: number;
    appendString?: string | null;
  }>;
  enablePlaceholderFallback?: boolean;
}

export interface DiscordMediumEvent {
  id: string;
  key: "discord";
  filters: { expression: Record<string, unknown> } | null;
  rateLimits?: Array<{ id: string; timeWindowSeconds: number; limit: number }>;
  details: DiscordMediumEventDetails;
}

export interface UserFeedForDelivery {
  id: string;
  url: string;
  debug?: boolean;
  maxDailyArticles?: number;
  connections: IFeedConnections;
  passingComparisons?: string[];
  blockingComparisons?: string[];
  formatOptions?: IUserFeedFormatOptions;
  externalProperties?: IExternalFeedProperty[];
  dateCheckOptions?: IUserFeedDateCheckOptions;
  feedRequestLookupKey?: string;
  user: {
    discordUserId: string;
  };
  users: Array<{
    externalCredentials?: Array<{
      type: string;
      data: Record<string, string>;
    }>;
    preferences?: {
      dateFormat?: string;
      dateTimezone?: string;
      dateLocale?: string;
    };
  }>;
}

export type { UserForDelivery } from "../../repositories/interfaces/user-feed.types";
