import { DiscordMediumEvent } from "../../../common";

export interface SendTestDiscordChannelArticleInput {
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
      channel: {
        id: string;
      };
      content?: string;
      embeds: DiscordMediumEvent["details"]["embeds"];
      formatter?: {
        stripImages?: boolean;
        formatTables?: boolean;
      };
      splitOptions?: {
        splitChar?: string;
        appendChar?: string;
        prependChar?: string;
      };
    };
  };
}
