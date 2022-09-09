export type MediumKey = "discord";

export interface BaseMedium {
  key: MediumKey;
}

export interface DiscordMediumPayload extends BaseMedium {
  key: "discord";
  channelId: string;
}

export type MediumPayload = DiscordMediumPayload;

export interface FeedV2Event {
  article: {
    id: string;
    url: string;
    passingComparisons: string[];
    blockingComparisons: string[];
  };
  mediums: MediumPayload[];
}
