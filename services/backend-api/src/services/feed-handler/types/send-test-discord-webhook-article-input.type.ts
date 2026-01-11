import {
  CustomPlaceholderDto,
  DiscordMediumEvent,
  DiscordMediumFormatterOptions,
} from "../../../common";
import { FeedConnectionDiscordWebhookType } from "../../../features/feeds/constants";
import { DiscordWebhookConnection } from "../../../features/feeds/entities/feed-connections";

export interface SendTestDiscordWebhookArticleInput {
  details: {
    type: "discord";
    feed: {
      url: string;
      formatOptions: {
        dateFormat?: string | undefined;
      };
    };
    article?: {
      id: string;
    };
    mediumDetails: {
      webhook: {
        id: string;
        token: string;
        name?: string;
        iconUrl?: string;
        type?: FeedConnectionDiscordWebhookType | null;
      };
      content?: string;
      forumThreadTitle?: DiscordWebhookConnection["details"]["forumThreadTitle"];
      embeds: DiscordMediumEvent["details"]["embeds"];
      formatter?: DiscordMediumFormatterOptions;
      splitOptions?: DiscordMediumEvent["details"]["splitOptions"];
      mentions?: DiscordWebhookConnection["mentions"];
      customPlaceholders?: CustomPlaceholderDto[];
      placeholderLimits?: DiscordWebhookConnection["details"]["placeholderLimits"];
      enablePlaceholderFallback?: boolean;
    };
  };
}
