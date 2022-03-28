export interface GuildSubscription {
  /**
   * In seconds
   */
  refresh_rate: number;
  ignore_refresh_rate_benefit: boolean;
  guild_id: string;
  extra_feeds: number;
  expire_at: string;
}
