import {
  CustomPlaceholderDto,
  DiscordMediumEvent,
  DiscordMediumFormatterOptions,
  ExternalPropertyDto,
} from "../../../common";
import { FeedRequestLookupDetails } from "../../../common/types/feed-request-lookup-details.type";
import {
  FeedConnectionDiscordChannelType,
  FeedConnectionDiscordWebhookType,
} from "../../../features/feeds/constants";
import { DiscordChannelConnection } from "../../../features/feeds/entities/feed-connections";

export interface SendTestDiscordChannelArticleInput {
  details: {
    type: "discord";
    includeCustomPlaceholderPreviews?: boolean;
    feed: {
      url: string;
      formatOptions: {
        dateFormat?: string | undefined;
        dateTimezone?: string | undefined;
        dateLocale?: string;
      };
      externalProperties: Array<ExternalPropertyDto> | undefined | null;
      requestLookupDetails: FeedRequestLookupDetails | undefined;
    };
    article?: {
      id: string;
    };
    mediumDetails: {
      channel?: {
        id: string;
        type?: FeedConnectionDiscordChannelType | null;
      };
      webhook?: {
        id: string;
        token: string;
        name?: string;
        iconUrl?: string;
        type?: FeedConnectionDiscordWebhookType | null;
        threadId?: string;
      };
      content?: string;
      embeds: DiscordMediumEvent["details"]["embeds"];
      formatter?: DiscordMediumFormatterOptions;
      splitOptions?: DiscordMediumEvent["details"]["splitOptions"];
      channelNewThreadTitle?: DiscordChannelConnection["details"]["channelNewThreadTitle"];
      channelNewThreadExcludesPreview?: DiscordChannelConnection["details"]["channelNewThreadExcludesPreview"];
      forumThreadTitle?: DiscordChannelConnection["details"]["forumThreadTitle"];
      forumThreadTags?: DiscordChannelConnection["details"]["forumThreadTags"];
      mentions?: DiscordChannelConnection["mentions"];
      placeholderLimits?: DiscordChannelConnection["details"]["placeholderLimits"];
      enablePlaceholderFallback?: DiscordChannelConnection["details"]["enablePlaceholderFallback"];
      customPlaceholders?: CustomPlaceholderDto[];
      components?: DiscordMediumEvent["details"]["components"];
      componentsV2?: DiscordMediumEvent["details"]["componentsV2"];
    };
  };
}
