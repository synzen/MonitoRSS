export interface DiscordMediumEvent {
  key: "discord";
  filters: {
    expression: Record<string, unknown>;
  } | null;
  details: {
    guildId: string;
    channel?: {
      id: string;
    };
    webhook?: {
      id: string;
      token: string;
    };
    content?: string;
    embeds?: Array<{
      title?: string;
      description?: string;
      url?: string;
      color?: number;
      footer?: {
        text: string;
        iconUrl?: string;
      };
      image?: {
        url: string;
      };
      thumbnail?: {
        url: string;
      };
      author?: {
        name: string;
        url?: string;
        iconUrl?: string;
      };
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
      timestamp?: "article" | "now";
    }>;
    formatter: {
      stripImages?: boolean;
      formatTables?: boolean;
    };
    splitOptions?: {
      splitChar?: string;
      appendChar?: string;
      prependChar?: string;
    };
  };
}
