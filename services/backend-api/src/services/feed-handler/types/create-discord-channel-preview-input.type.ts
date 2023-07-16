import { DiscordMediumEvent } from "../../../common";

export interface CreateDiscordChannelPreviewInput {
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
      guildId: string;
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
        splitChar?: string | null;
        appendChar?: string | null;
        prependChar?: string | null;
      };
    };
  };
}
