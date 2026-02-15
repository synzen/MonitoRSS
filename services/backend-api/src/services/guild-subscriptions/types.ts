export interface GuildSubscription {
  refresh_rate: number;
  ignore_refresh_rate_benefit: boolean;
  guild_id: string;
  extra_feeds: number;
  expire_at: string;
}

export interface GuildSubscriptionFormatted {
  guildId: string;
  maxFeeds: number;
  refreshRate: number;
  slowRate: boolean;
  expireAt: string;
}

export interface GetAllSubscriptionsOptions {
  filters?: {
    serverIds?: string[];
  };
}
