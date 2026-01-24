export interface IBannedFeed {
  id: string;
  url: string;
  reason?: string;
  guildIds: string[];
}

export interface IBannedFeedRepository {}
