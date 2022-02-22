import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'node-fetch';
import { DISCORD_API_BASE_URL } from '../../../constants/discord';
import { RESTHandler } from '@synzen/discord-rest';
import { DiscordAPIError } from '../../../common/errors/DiscordAPIError';

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

@Injectable()
export class DiscordAPIService {
  API_URL = DISCORD_API_BASE_URL;
  BOT_TOKEN: string;
  restHandler: RESTHandler;

  constructor(private readonly configService: ConfigService) {
    this.BOT_TOKEN = configService.get<string>('discordBotToken') as string;
    this.restHandler = new RESTHandler();
  }

  /**
   * Execute a request to Discord's API that requires Bot authorization.
   *
   * @param endpoint The endpoint to request
   * @returns The response from Discord
   */
  async executeBotRequest<T>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> {
    const url = `${this.API_URL}${endpoint}`;
    const res = await this.restHandler.fetch(url, {
      method: options?.method || 'GET',
      headers: {
        Authorization: `Bot ${this.BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    await this.handleJSONResponseError(res);

    return res.json();
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
    options?: RequestOptions,
  ): Promise<T> {
    const url = `${this.API_URL}${endpoint}`;
    const res = await this.restHandler.fetch(url, {
      method: options?.method || 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    await this.handleJSONResponseError(res);

    return res.json();
  }

  private async handleJSONResponseError(res: Response): Promise<void> {
    if (!res.ok && res.status < 500) {
      throw new DiscordAPIError(
        `Discord API request failed (${JSON.stringify(await res.json())})`,
        res.status,
      );
    }

    if (!res.ok) {
      throw new DiscordAPIError(
        `Discord API request failed (${res.status} - Discord internal error)`,
        res.status,
      );
    }
  }
}
