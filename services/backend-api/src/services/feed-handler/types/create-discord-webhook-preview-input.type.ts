import {
  DiscordMediumEvent,
  DiscordMediumFormatterOptions,
} from "../../../common";

export interface CreateDiscordWebhookPreviewInput {
  details: {
    type: "discord";
    feed: {
      url: string;
      formatOptions: {
        dateFormat: string | undefined;
      };
    };
    article?: {
      id: string;
    };
    mediumDetails: {
      guildId: string;
      webhook: {
        id: string;
        token: string;
        name?: string;
        iconUrl?: string;
      };
      content?: string;
      embeds: DiscordMediumEvent["details"]["embeds"];
      formatter?: DiscordMediumFormatterOptions;
      splitOptions?: DiscordMediumEvent["details"]["splitOptions"];
    };
  };
}
