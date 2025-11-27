import {
  FeedConnectionDiscordChannelType,
  FeedConnectionDiscordComponentType,
} from "../../features/feeds/constants";

// V2 Component Types for DiscordMediumEvent
export interface DiscordMediumEmojiV2 {
  id: string;
  name?: string | null;
  animated?: boolean | null;
}

export interface DiscordMediumMediaV2 {
  url: string;
}

export interface DiscordMediumTextDisplayV2 {
  type: FeedConnectionDiscordComponentType.TextDisplay;
  content: string;
}

export interface DiscordMediumThumbnailV2 {
  type: FeedConnectionDiscordComponentType.Thumbnail;
  media: DiscordMediumMediaV2;
  description?: string | null;
  spoiler?: boolean;
}

export interface DiscordMediumEvent {
  key: "discord";
  filters: {
    expression: Record<string, unknown>;
  } | null;
  details: {
    guildId: string;
    channelNewThreadTitle?: string;
    channel?: {
      id: string;
      type?: FeedConnectionDiscordChannelType | null;
      guildId: string;
    };
    webhook?: {
      id: string;
      token: string;
    };
    components?: Array<{
      type: number;
      components: Array<{
        type: number;
        style: number;
        label: string;
        emoji?: {
          id: string;
          name?: string | null;
          animated?: boolean | null;
        } | null;
        url?: string | null;
      }>;
    }> | null;
    componentsV2?: Array<Record<string, unknown>> | null;
    content?: string;
    embeds?: Array<{
      title?: string;
      description?: string;
      url?: string;
      color?: number;
      footer?: {
        text: string;
        iconUrl?: string;
      };
      image?: {
        url: string;
      };
      thumbnail?: {
        url: string;
      };
      author?: {
        name: string;
        url?: string;
        iconUrl?: string;
      };
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
      timestamp?: "article" | "now";
    }>;
    formatter: {
      stripImages?: boolean;
      formatTables?: boolean;
    };
    splitOptions?: {
      splitChar?: string | null;
      appendChar?: string | null;
      prependChar?: string | null;
    };
  };
}
