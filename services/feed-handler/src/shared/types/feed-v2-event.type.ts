export enum MediumKey {
  Discord = "discord",
}

interface BaseMediumPayload {
  key: MediumKey;
  details: Record<string, unknown>;
}

export interface DiscordMediumPayload extends BaseMediumPayload {
  key: MediumKey.Discord;
  details: {
    guildId: string;
    channels?: Array<{
      id: string;
    }>;
    webhooks?: Array<{
      id: string;
      token: string;
    }>;
    content?: string;
  };
}

export type MediumPayload = DiscordMediumPayload;

export interface FeedV2Event {
  feed: {
    id: string;
    url: string;
    passingComparisons: string[];
    blockingComparisons: string[];
  };
  mediums: MediumPayload[];
}
