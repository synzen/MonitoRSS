import { inject, injectable } from 'inversify';
import { Config } from '../config-schema';
import { request } from 'undici';

export interface SubscriptionAPIResponse {
  /**
   * In seconds
   */
  refresh_rate: number
  ignore_refresh_rate_benefit: boolean
  guild_id: string
  extra_feeds: number
  expire_at: string
}

export interface ISubscriptionService {
  getSubscriptionOfGuild(guildId: string): Promise<SubscriptionAPIResponse | null>
  getAllSubscriptionsOfGuilds(): Promise<SubscriptionAPIResponse[]>
}

@injectable()
export default class SubscriptionService implements ISubscriptionService {
  private host?: string;

  private accessToken?: string;

  constructor(
    @inject('Config') private config: Config,
  ) {
    this.host = config.apis.subscriptions.host;
    this.accessToken = config.apis.subscriptions.accessToken;
  }

  public async getSubscriptionOfGuild(guildId: string): Promise<SubscriptionAPIResponse | null> {
    const { host, accessToken } = this;

    if (!host || !accessToken) {
      // The service is disabled/not configured
      return null;
    }

    try {
      const res = await request(`${host}/guilds/${guildId}`, {
        method: 'GET',
        headers: {
          Authorization: accessToken,
        },
      });

      if (res.statusCode === 200) {
        const json = await res.body.json() as SubscriptionAPIResponse;
        
        return json;
      }

      if (res.statusCode === 404) {
        return null;
      }

      throw new Error(`Bad status code ${res.statusCode}`);
    } catch (err) {
      /**
       * Errors should not be propagated to maintain normal functions.
       */
      console.error(err);

      return null;
    }
  }

  public async getAllSubscriptionsOfGuilds(): Promise<SubscriptionAPIResponse[]> {
    const { host, accessToken } = this;

    if (!host || !accessToken) {
      // The service is disabled/not configured
      return [];
    }

    try {
      const res = await request(`${host}/guilds`, {
        method: 'GET',
        headers: {
          Authorization: accessToken,
        },
      });

      if (res.statusCode === 200) {
        const data = await res.body.json() as SubscriptionAPIResponse[];
        
        return data;
      }

      throw new Error(`Bad status code ${res.statusCode}`);
    } catch (err) {
      /**
       * Errors should not be propagated to maintain normal functions.
       */
      console.error(err);

      return [];
    }
  }

}
