import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GuildSubscription } from "./types/guild-subscription.type";
import logger from "../../utils/logger";
import qs from "qs";
import { GuildSubscriptionFormatted } from "./types";

interface GetAllSubscriptionsOptions {
  filters?: {
    serverIds?: string[];
  };
}

@Injectable()
export class GuildSubscriptionsService {
  apiHost: string;
  accessToken: string;
  enabled: boolean;
  readonly baseMaxFeeds: number = 5;

  constructor(private readonly configService: ConfigService) {
    this.apiHost = this.configService.get<string>(
      "BACKEND_API_SUBSCRIPTIONS_HOST"
    ) as string;

    this.accessToken = this.configService.get<string>(
      "BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN"
    ) as string;

    const apiEnabled =
      this.configService.get<boolean>("BACKEND_API_SUBSCRIPTIONS_ENABLED") ||
      false;

    this.enabled = !!this.apiHost && !!this.accessToken && apiEnabled;
  }

  mapApiResponse(response: GuildSubscription): GuildSubscriptionFormatted {
    const refreshRateSeconds = response.refresh_rate;
    const ignoreFasterRefreshRate = response.ignore_refresh_rate_benefit;
    const slowRate = ignoreFasterRefreshRate;

    return {
      guildId: response.guild_id,
      maxFeeds: this.baseMaxFeeds + response.extra_feeds,
      refreshRate: refreshRateSeconds,
      expireAt: response.expire_at,
      slowRate,
    };
  }

  async getSubscription(
    guildId: string
  ): Promise<GuildSubscriptionFormatted | null> {
    const { apiHost, accessToken, enabled } = this;

    if (!enabled) {
      // The service is disabled/not configured
      return null;
    }

    try {
      const res = await fetch(`${apiHost}/guilds/${guildId}`, {
        headers: {
          Authorization: accessToken,
        },
      });

      if (res.status === 200) {
        const json = (await res.json()) as GuildSubscription;

        return this.mapApiResponse(json);
      }

      if (res.status === 404) {
        return null;
      }

      throw new Error(`Bad status code ${res.status}`);
    } catch (err) {
      logger.error(`Failed to get subscription for guild ${guildId}`, {
        stack: err.stack,
      });

      /**
       * Errors should not be propagated to maintain normal functions.
       */
      return null;
    }
  }

  async getAllSubscriptions(
    options?: GetAllSubscriptionsOptions
  ): Promise<GuildSubscriptionFormatted[]> {
    const { apiHost, accessToken, enabled } = this;

    if (!enabled) {
      // The service is disabled/not configured
      return [];
    }

    try {
      const query = qs.stringify({
        filters: {
          serverIds: options?.filters?.serverIds,
        },
      });

      const url = `${apiHost}/guilds?${query}`;

      const res = await fetch(url, {
        headers: {
          Authorization: accessToken,
        },
      });

      if (res.status === 200) {
        const data = (await res.json()) as GuildSubscription[];

        return data.map((sub) => this.mapApiResponse(sub));
      }

      throw new Error(`Bad status code ${res.status}`);
    } catch (err) {
      logger.error(`Failed to get subscriptions`, {
        stack: err.stack,
      });

      /**
       * Errors should not be propagated to maintain normal functions.
       */
      return [];
    }
  }
}
