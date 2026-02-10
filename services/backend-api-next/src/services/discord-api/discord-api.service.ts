import {
  REST,
  DiscordAPIError as DjsDiscordAPIError,
  HTTPError,
} from "@discordjs/rest";
import type { RequestData } from "@discordjs/rest";
import type { Config } from "../../config";
import { DiscordAPIError } from "../../shared/exceptions/discord-api.error";
import type {
  DiscordGuildMember,
  DiscordGuildChannel,
  DiscordGuild,
  DiscordWebhook,
  DiscordUser,
} from "../../shared/types/discord.types";
import type { RequestOptions } from "./types";

export class DiscordApiService {
  private readonly BOT_TOKEN: string;
  private readonly CLIENT_ID: string;
  private readonly rest: REST;

  constructor(private readonly config: Config) {
    this.BOT_TOKEN = config.BACKEND_API_DISCORD_BOT_TOKEN;
    this.CLIENT_ID = config.BACKEND_API_DISCORD_CLIENT_ID;

    let apiBase = config.BACKEND_API_DISCORD_API_BASE_URL;

    if (/\/api\/v\d+$/.test(apiBase)) {
      apiBase = apiBase.replace(/\/v\d+$/, "");
    } else if (!apiBase.endsWith("/api")) {
      apiBase = `${apiBase}/api`;
    }

    const rest = new REST({
      version: "10",
      api: apiBase,
    });
    rest.setToken(this.BOT_TOKEN);
    this.rest = rest;
  }

  async executeBotRequest<T>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> {
    const method = options?.method || "GET";
    const requestData: RequestData = {
      body: options?.body ? JSON.parse(options.body) : undefined,
      auth: true,
      authPrefix: "Bot",
    };

    // When a 401 is received, discordjs calls rest.setToken(null) which causes
    // all subsequent requests to fail with a confusing error message about missing token
    // Re-set token before each request to handle cases where it may have been
    // cleared (e.g., @discordjs/rest clears token on 401 responses)
    this.rest.setToken(this.BOT_TOKEN);

    try {
      const result = await this.executeRequest(
        endpoint as `/${string}`,
        method,
        requestData,
      );

      return result as T;
    } catch (error) {
      this.convertError(error, endpoint);
    }
  }

  async executeBearerRequest<T>(
    accessToken: string,
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> {
    const method = options?.method || "GET";
    const requestData: RequestData = {
      body: options?.body ? JSON.parse(options.body) : undefined,
      auth: false,
      authPrefix: "Bearer",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    try {
      const result = await this.executeRequest(
        endpoint as `/${string}`,
        method,
        requestData,
      );

      return result as T;
    } catch (error) {
      this.convertError(error, endpoint);
    }
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

  private async executeRequest(
    endpoint: `/${string}`,
    method: string,
    requestData: RequestData,
  ): Promise<unknown> {
    switch (method) {
      case "GET":
        return this.rest.get(endpoint, requestData);
      case "POST":
        return this.rest.post(endpoint, requestData);
      case "PUT":
        return this.rest.put(endpoint, requestData);
      case "DELETE":
        return this.rest.delete(endpoint, requestData);
      case "PATCH":
        return this.rest.patch(endpoint, requestData);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  private convertError(error: unknown, endpoint: string): never {
    if (error instanceof DjsDiscordAPIError) {
      throw new DiscordAPIError(
        `Discord API request to ${endpoint} failed (${JSON.stringify(error.rawError)})`,
        error.status,
      );
    }

    if (error instanceof HTTPError) {
      throw new DiscordAPIError(
        `Discord API request to ${endpoint} failed (${error.status} - ${error.message})`,
        error.status,
      );
    }

    throw error;
  }
}
