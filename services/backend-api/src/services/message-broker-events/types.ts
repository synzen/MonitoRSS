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

export type {
  UserForDelivery,
  WorkspaceForDelivery,
} from "../../repositories/interfaces/user-feed.types";
