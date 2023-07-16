import { DiscordMediumEvent } from "../../../common";
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
      mentions?: DiscordWebhookConnection["mentions"];
      placeholderLimits?: DiscordWebhookConnection["details"]["placeholderLimits"];
    };
  };
}
