import {
  CustomPlaceholderDto,
  DiscordMediumEvent,
  ExternalPropertyDto,
} from "../../../common";
import { DiscordChannelConnection } from "../../../features/feeds/entities/feed-connections";

export interface CreateDiscordChannelPreviewInput {
  details: {
    type: "discord";
    includeCustomPlaceholderPreviews?: boolean;
    feed: {
      url: string;
      formatOptions: {
        dateFormat?: string | undefined;
        dateTimezone?: string | undefined;
        dateLocale?: string | undefined;
      };
      externalProperties?: Array<ExternalPropertyDto> | null;
    };
    article?: {
      id: string;
    };
    mediumDetails: {
      guildId: string;
      channel?: {
        id: string;
      };
      webhook?: {
        id: string;
        token: string;
        name?: string;
        iconUrl?: string;
      };
      content?: string;
      embeds: DiscordMediumEvent["details"]["embeds"];
      formatter?: {
        stripImages?: boolean;
        formatTables?: boolean;
      };
      splitOptions?: {
        splitChar?: string | null;
        appendChar?: string | null;
        prependChar?: string | null;
      };
      mentions?: DiscordChannelConnection["mentions"];
      customPlaceholders?: CustomPlaceholderDto[] | null;
      placeholderLimits?:
        | DiscordChannelConnection["details"]["placeholderLimits"]
        | null;
      enablePlaceholderFallback?: boolean;
      components?: DiscordMediumEvent["details"]["components"];
    };
  };
}
