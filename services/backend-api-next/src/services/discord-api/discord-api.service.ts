import { RESTHandler } from "@synzen/discord-rest";
import type { FetchResponse } from "@synzen/discord-rest/dist/types/FetchResponse";
import { Environment, type Config } from "../../config";
import { DiscordAPIError } from "../../shared/exceptions/discord-api.error";
import type {
  DiscordGuildMember,
  DiscordGuildChannel,
  DiscordGuild,
  DiscordWebhook,
  DiscordUser,
} from "../../shared/types/discord.types";
import { DISCORD_API_BASE_URL } from "../../shared/constants/discord";
import type { RequestOptions } from "./types";

export class DiscordApiService {
  private readonly API_URL = DISCORD_API_BASE_URL;
  private readonly BOT_TOKEN: string;
  private readonly CLIENT_ID: string;
  private readonly restHandler: RESTHandler;

  constructor(private readonly config: Config) {
    this.BOT_TOKEN = config.BACKEND_API_DISCORD_BOT_TOKEN;
    this.CLIENT_ID = config.BACKEND_API_DISCORD_CLIENT_ID;
    this.restHandler = new RESTHandler({
      delayOnInvalidThreshold: config.NODE_ENV !== Environment.Test,
    });
  }

  async executeBotRequest<T>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> {
    const url = `${this.API_URL}${endpoint}`;
    const res = await this.restHandler.fetch(url, {
      method: (options?.method as never) || "GET",
      headers: {
        Authorization: `Bot ${this.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: options?.body,
    });

    await this.handleJSONResponseError({ res, url });

    if (res.status === 204) {
      return null as T;
    } else {
      return res.json() as Promise<T>;
    }
  }

  async executeBearerRequest<T>(
    accessToken: string,
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> {
    const url = `${this.API_URL}${endpoint}`;
    const res = await this.restHandler.fetch(url, {
      method: (options?.method as never) || "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    await this.handleJSONResponseError({ res, url });

    return res.json() as Promise<T>;
  }

  async getBot(): Promise<DiscordUser> {
    return this.executeBotRequest(`/users/${this.CLIENT_ID}`);
  }

  async getChannel(channelId: string): Promise<DiscordGuildChannel> {
    return this.executeBotRequest(`/channels/${channelId}`);
  }

  async getGuild(guildId: string): Promise<DiscordGuild> {
    return this.executeBotRequest(`/guilds/${guildId}`);
  }

  async getWebhook(webhookId: string): Promise<DiscordWebhook> {
    return this.executeBotRequest(`/webhooks/${webhookId}`);
  }

  async getGuildMember(
    guildId: string,
    userId: string,
  ): Promise<DiscordGuildMember> {
    return this.executeBotRequest(`/guilds/${guildId}/members/${userId}`);
  }

  async addGuildMemberRole(data: {
    guildId: string;
    userId: string;
    roleId: string;
  }): Promise<void> {
    const { guildId, userId, roleId } = data;

    await this.executeBotRequest(
      `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      {
        method: "PUT",
      },
    );
  }

  async removeGuildMemberRole(data: {
    guildId: string;
    userId: string;
    roleId: string;
  }): Promise<void> {
    const { guildId, userId, roleId } = data;

    await this.executeBotRequest(
      `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      {
        method: "DELETE",
      },
    );
  }

  private async handleJSONResponseError({
    res,
    url,
  }: {
    res: FetchResponse;
    url: string;
  }): Promise<void> {
    if (res.status >= 400 && res.status < 500) {
      throw new DiscordAPIError(
        `Discord API request to ${url} failed (${JSON.stringify(
          await res.json(),
        )})`,
        res.status,
      );
    }

    if (res.status >= 500) {
      throw new DiscordAPIError(
        `Discord API request to ${url} failed (${res.status} - Discord internal error)`,
        res.status,
      );
    }
  }
}
