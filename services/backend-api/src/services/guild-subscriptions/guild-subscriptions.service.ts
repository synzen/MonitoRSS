import qs from "qs";
import type { Config } from "../../config";
import logger from "../../infra/logger";
import type {
  GuildSubscription,
  GuildSubscriptionFormatted,
  GetAllSubscriptionsOptions,
} from "./types";

export class GuildSubscriptionsService {
  private readonly apiHost: string;
  private readonly accessToken: string;
  private readonly enabled: boolean;
  private readonly baseMaxFeeds = 5;

  constructor(private readonly config: Config) {
    this.apiHost = config.BACKEND_API_SUBSCRIPTIONS_HOST ?? "";
    this.accessToken = config.BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN ?? "";
    const apiEnabled = config.BACKEND_API_SUBSCRIPTIONS_ENABLED || false;
    this.enabled = !!this.apiHost && !!this.accessToken && apiEnabled;
  }

  async getSubscription(
    guildId: string,
  ): Promise<GuildSubscriptionFormatted | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const url = `${this.apiHost}/guilds/${guildId}`;

      const res = await fetch(url, {
        headers: {
          Authorization: this.accessToken,
        },
      });

      if (res.status === 200) {
        const response = (await res.json()) as GuildSubscription;
        return this.mapApiResponse(response);
      }

      if (res.status === 404) {
        return null;
      }

      throw new Error(
        `Unexpected status code ${res.status} when getting subscription for guild ${guildId}`,
      );
    } catch (err) {
      logger.error("Failed to get guild subscription", {
        guildId,
        error: (err as Error).stack,
      });
      return null;
    }
  }

  async getAllSubscriptions(
    options?: GetAllSubscriptionsOptions,
  ): Promise<GuildSubscriptionFormatted[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const query = qs.stringify({
        filters: {
          serverIds: options?.filters?.serverIds,
        },
      });

      const url = `${this.apiHost}/guilds?${query}`;

      const res = await fetch(url, {
        headers: {
          Authorization: this.accessToken,
        },
      });

      if (res.status === 200) {
        const response = (await res.json()) as GuildSubscription[];
        return response.map((r) => this.mapApiResponse(r));
      }

      throw new Error(
        `Unexpected status code ${res.status} when getting all subscriptions`,
      );
    } catch (err) {
      logger.error("Failed to get all guild subscriptions", {
        error: (err as Error).stack,
      });
      return [];
    }
  }

  private mapApiResponse(
    response: GuildSubscription,
  ): GuildSubscriptionFormatted {
    return {
      guildId: response.guild_id,
      maxFeeds: this.baseMaxFeeds + response.extra_feeds,
      refreshRate: response.refresh_rate,
      slowRate: response.ignore_refresh_rate_benefit,
      expireAt: response.expire_at,
    };
  }
}
