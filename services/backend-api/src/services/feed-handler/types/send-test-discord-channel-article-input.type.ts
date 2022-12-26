import { DiscordChannelConnection } from "../../../features/feeds/entities/feed-connections";

export interface SendTestDiscordChannelArticleInput {
  details: {
    type: "discord";
    feed: {
      url: string;
    };
    mediumDetails: {
      channel: {
        id: string;
      };
      content?: string;
      embeds: DiscordChannelConnection["details"]["embeds"];
    };
  };
}
