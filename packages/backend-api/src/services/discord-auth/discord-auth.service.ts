import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import {
  DISCORD_API_BASE_URL,
  DISCORD_AUTH_ENDPOINT,
  DISCORD_TOKEN_ENDPOINT,
  DISCORD_TOKEN_REVOCATION_ENDPOINT,
} from '../../constants/discord';

export interface DiscordAuthToken {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

@Injectable()
export class DiscordAuthService {
  OAUTH_SCOPES = 'identify guilds';
  OAUTH_REDIRECT_URI = '';
  CLIENT_ID = '';
  CLIENT_SECRET = '';

  constructor(private readonly configService: ConfigService) {
    this.CLIENT_ID = this.configService.get<string>(
      'discordClientId',
    ) as string;
    this.CLIENT_SECRET = this.configService.get<string>(
      'discordClientSecret',
    ) as string;
    this.OAUTH_REDIRECT_URI = this.configService.get<string>(
      'discordRedirectUri',
    ) as string;
  }

  getAuthorizationUrl() {
    return (
      `${DISCORD_API_BASE_URL}/${DISCORD_AUTH_ENDPOINT}?response_type=code` +
      `&client_id=${this.CLIENT_ID}&scope=${this.OAUTH_SCOPES}&` +
      `redirect_uri=${this.OAUTH_REDIRECT_URI}&prompt=consent`
    );
  }

  /**
   * Get a Discord token object from the Discord API given an authorization code.
   *
   * @param authorizationCode The authorization code returned by Discord
   * @returns The Discord token object
   */
  async createAccessToken(authorizationCode: string) {
    const url = `${DISCORD_API_BASE_URL}${DISCORD_TOKEN_ENDPOINT}`;

    const searchParams = new URLSearchParams({
      client_id: this.CLIENT_ID,
      client_secret: this.CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: this.OAUTH_REDIRECT_URI,
      scope: this.OAUTH_SCOPES,
    });

    const res = await fetch(url, {
      method: 'POST',
      body: searchParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!res.ok && res.status < 500) {
      throw new Error(
        `Failed to create access token (${res.status}): ${JSON.stringify(
          await res.json(),
        )}`,
      );
    }

    if (!res.ok) {
      throw new Error(
        `Failed to create access token (${res.status} - Discord internal error)`,
      );
    }

    const tokenObject = (await res.json()) as DiscordAuthToken;

    return this.formatTokenWithExpiresAt(tokenObject);
  }

  async refreshToken(token: DiscordAuthToken) {
    const url = `${DISCORD_API_BASE_URL}${DISCORD_TOKEN_ENDPOINT}`;

    const searchParams = new URLSearchParams({
      client_id: this.CLIENT_ID,
      client_secret: this.CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
      redirect_uri: this.OAUTH_REDIRECT_URI,
      scope: this.OAUTH_SCOPES,
    });

    const res = await fetch(url, {
      method: 'POST',
      body: searchParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!res.ok && res.status < 500) {
      throw new Error(
        `Failed to refresh access token (${res.status}): ${JSON.stringify(
          await res.json(),
        )}`,
      );
    }

    if (!res.ok) {
      throw new Error(
        `Failed to refresh access token (${res.status} - Discord internal error)`,
      );
    }

    const tokenObject = (await res.json()) as DiscordAuthToken;

    return this.formatTokenWithExpiresAt(tokenObject);
  }

  /**
   * Revoke a Discord token.
   *
   * @param token The Discord token object
   */
  async revokeToken(token: DiscordAuthToken) {
    await Promise.all([
      this.revokeAccessOrRefreshToken(token, 'access'),
      this.revokeAccessOrRefreshToken(token, 'refresh'),
    ]);
  }

  private async revokeAccessOrRefreshToken(
    token: DiscordAuthToken,
    tokenType: 'access' | 'refresh',
  ) {
    const url = `${DISCORD_API_BASE_URL}${DISCORD_TOKEN_REVOCATION_ENDPOINT}`;

    const revokeAccessParams = new URLSearchParams({
      token: tokenType === 'access' ? token.access_token : token.refresh_token,
      client_id: this.CLIENT_ID,
      client_secret: this.CLIENT_SECRET,
    });

    const res = await fetch(url, {
      method: 'POST',
      body: revokeAccessParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to revoke ${tokenType} token (${res.status}): ${JSON.stringify(
          await res.json(),
        )}`,
      );
    }
  }

  /**
   * Format the Discord token object to return an object containing the expiresAt field,
   * which is the time at which the token expires in seconds.
   *
   * @param tokenObject The token object returned by Discord
   * @returns The formatted token object containing expiresAt
   */
  private formatTokenWithExpiresAt(tokenObject: DiscordAuthToken) {
    const now = new Date();
    // expiresAt must be in seconds to match expire_in
    const expiresAt = Math.round(now.getTime() / 1000) + tokenObject.expires_in;
    const formatted = {
      ...tokenObject,
      expiresAt,
    };

    return formatted;
  }
}
