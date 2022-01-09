import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch, { Response } from 'node-fetch';
import {
  DISCORD_API_BASE_URL,
  DISCORD_API_VERSION,
} from '../../../constants/discord';

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

@Injectable()
export class DiscordAPIService {
  API_URL = DISCORD_API_BASE_URL;
  API_VERSION = DISCORD_API_VERSION;
  BOT_TOKEN: string;

  constructor(private readonly configService: ConfigService) {
    this.BOT_TOKEN = configService.get<string>('discordBotToken') as string;
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
    const url = `${this.API_URL}/${this.API_VERSION}${endpoint}`;
    const res = await fetch(url, {
      method: options?.method || 'GET',
      headers: {
        Authorization: `Bot ${this.BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    this.handleJSONResponseError(res);

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
    const url = `${this.API_URL}/${this.API_VERSION}${endpoint}`;
    const res = await fetch(url, {
      method: options?.method || 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    this.handleJSONResponseError(res);

    return res.json();
  }

  private handleJSONResponseError(res: Response): void {
    if (!res.ok && res.status < 500) {
      throw new Error(
        `Discord API request failed (${JSON.stringify(res.json())})`,
      );
    }

    if (!res.ok) {
      throw new Error(
        `Discord API request failed (${res.status} - Discord internal error)`,
      );
    }
  }
}
