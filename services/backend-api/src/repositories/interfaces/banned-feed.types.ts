export interface IBannedFeed {
  id: string;
  url: string;
  reason?: string;
  guildIds: string[];
}

export interface IBannedFeedRepository {
  findByUrlForGuild(url: string, guildId: string): Promise<IBannedFeed | null>;
  create(input: Omit<IBannedFeed, "id">): Promise<IBannedFeed>;
  deleteAll(): Promise<void>;
}
