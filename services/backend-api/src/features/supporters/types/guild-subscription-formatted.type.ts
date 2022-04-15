export interface GuildSubscriptionFormatted {
  guildId: string;
  maxFeeds: number;
  refreshRate: number;
  slowRate: boolean;
  expireAt: string;
}
