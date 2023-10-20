import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DISCORD_API_BASE_URL } from "../../../constants/discord";
import { RESTHandler } from "@synzen/discord-rest";
import { DiscordAPIError } from "../../../common/errors/DiscordAPIError";
import {
  DiscordGuildMember,
  DiscordGuildChannel,
  DiscordGuild,
  DiscordWebhook,
} from "../../../common";
import { DiscordUser } from "../../../features/discord-users/types/DiscordUser.type";
import { FetchResponse } from "@synzen/discord-rest/dist/types/FetchResponse";

interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;
}

@Injectable()
export class DiscordAPIService {
  API_URL = DISCORD_API_BASE_URL;
  BOT_TOKEN: string;
  restHandler: RESTHandler;

  constructor(private readonly configService: ConfigService) {
    this.BOT_TOKEN = configService.get<string>(
      "BACKEND_API_DISCORD_BOT_TOKEN"
    ) as string;
    this.restHandler = new RESTHandler({
      /**
       * RESTHandler creates a node interval behind the scenes with this boolean, stopping
       * tests from tearing down gracefully.
       */
      delayOnInvalidThreshold: process.env.NODE_ENV === "test" ? false : true,
    });
  }

  /**
   * Execute a request to Discord's API that requires Bot authorization.
   *
   * @param endpoint The endpoint to request
   * @returns The response from Discord
   */
  async executeBotRequest<T>(
    endpoint: string,
    options?: RequestOptions
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

    if (res.status === HttpStatus.NO_CONTENT) {
      return null as T;
    } else {
      return res.json();
    }
  }

  /**
   * Execute a request to Discord's API that requires OAuth2 authorization granted by the end-user.
   *
   * @param accessToken The user's OAuth2 access token
   * @param endpoint The endpoint to request
   * @param options The request options
   * @returns The response from Discord
   */
  async executeBearerRequest<T>(
    accessToken: string,
    endpoint: string,
    options?: RequestOptions
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

    return res.json();
  }

  async getBot(): Promise<DiscordUser> {
    const botClientId = this.configService.get<string>(
      "BACKEND_API_DISCORD_CLIENT_ID"
    ) as string;

    return this.executeBotRequest(`/users/${botClientId}`);
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
    userId: string
  ): Promise<DiscordGuildMember> {
    return this.executeBotRequest(`/guilds/${guildId}/members/${userId}`);
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
          await res.json()
        )})`,
        res.status
      );
    }

    if (res.status >= 500) {
      throw new DiscordAPIError(
        `Discord API request to ${url} failed (${res.status} - Discord internal error)`,
        res.status
      );
    }
  }
}
