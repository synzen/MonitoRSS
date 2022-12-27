import { DiscordMediumEvent } from "../../../common";

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
      embeds: DiscordMediumEvent["details"]["embeds"];
    };
  };
}
