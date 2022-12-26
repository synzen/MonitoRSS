import { DiscordChannelConnection } from "../../../features/feeds/entities/feed-connections";

export interface SendTestDiscordWebhookArticleInput {
  details: {
    type: "discord";
    feed: {
      url: string;
    };
    mediumDetails: {
      webhook: {
        id: string;
        token: string;
        name?: string;
        iconUrl?: string;
      };
      content?: string;
      embeds: DiscordChannelConnection["details"]["embeds"];
    };
  };
}
