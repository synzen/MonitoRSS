import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { URLSearchParams } from "url";
import {
  DISCORD_API_BASE_URL,
  DISCORD_AUTH_ENDPOINT,
  DISCORD_TOKEN_ENDPOINT,
  DISCORD_TOKEN_REVOCATION_ENDPOINT,
} from "../../constants/discord";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { DiscordUser } from "../discord-users/types/DiscordUser.type";
import { PartialUserGuild } from "../discord-users/types/PartialUserGuild.type";
import { MANAGE_CHANNEL } from "./constants/permissions";
import { SessionAccessToken } from "./types/SessionAccessToken.type";

export interface DiscordAuthToken {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

@Injectable()
export class DiscordAuthService {
  OAUTH_SCOPES = "identify guilds";
  OAUTH_REDIRECT_URI = "";
  CLIENT_ID = "";
  CLIENT_SECRET = "";

  constructor(
    private readonly configService: ConfigService,
    private readonly discordApiService: DiscordAPIService
  ) {
    this.CLIENT_ID = this.configService.get<string>(
      "BACKEND_API_DISCORD_CLIENT_ID"
    ) as string;
    this.CLIENT_SECRET = this.configService.get<string>(
      "BACKEND_API_DISCORD_CLIENT_SECRET"
    ) as string;
    this.OAUTH_REDIRECT_URI = this.configService.get<string>(
      "BACKEND_API_DISCORD_REDIRECT_URI"
    ) as string;
  }

  getAuthorizationUrl(options?: { state?: string; additionalScopes?: string }) {
    return (
      `${DISCORD_API_BASE_URL}/${DISCORD_AUTH_ENDPOINT}?response_type=code` +
      `&client_id=${this.CLIENT_ID}&scope=${`${this.OAUTH_SCOPES}${
        options?.additionalScopes || ""
      }`}&` +
      `redirect_uri=${this.OAUTH_REDIRECT_URI}&prompt=consent${
        options?.state ? `&state=${options.state}` : ""
      }`
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
      grant_type: "authorization_code",
      code: authorizationCode,
      redirect_uri: this.OAUTH_REDIRECT_URI,
      scope: this.OAUTH_SCOPES,
    });

    const res = await fetch(url, {
      method: "POST",
      body: searchParams,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!res.ok && res.status < 500) {
      throw new Error(
        `Failed to create access token (${res.status}): ${JSON.stringify(
          await res.json()
        )}`
      );
    }

    if (!res.ok) {
      throw new Error(
        `Failed to create access token (${res.status} - Discord internal error)`
      );
    }

    const tokenObject = (await res.json()) as DiscordAuthToken;

    const { newToken, user } = await this.attachExtraDetailsToToken(
      tokenObject
    );

    return { token: newToken, user };
  }

  async refreshToken(token: DiscordAuthToken): Promise<SessionAccessToken> {
    const url = `${DISCORD_API_BASE_URL}${DISCORD_TOKEN_ENDPOINT}`;

    const searchParams = new URLSearchParams({
      client_id: this.CLIENT_ID,
      client_secret: this.CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
      redirect_uri: this.OAUTH_REDIRECT_URI,
      scope: this.OAUTH_SCOPES,
    });

    const res = await fetch(url, {
      method: "POST",
      body: searchParams,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!res.ok && res.status < 500) {
      throw new Error(
        `Failed to refresh access token (${res.status}): ${JSON.stringify(
          await res.json()
        )}`
      );
    }

    if (!res.ok) {
      throw new Error(
        `Failed to refresh access token (${res.status} - Discord internal error)`
      );
    }

    const tokenObject = (await res.json()) as DiscordAuthToken;

    const { newToken } = await this.attachExtraDetailsToToken(tokenObject);

    return newToken;
  }

  /**
   * Check whether an access token that's been stored in the user's session is expired.
   * @param sessionToken The access token stored in the user's session
   * @returns Whether the access token is expired
   */
  isTokenExpired(sessionToken: SessionAccessToken) {
    const now = new Date().getTime() / 1000;
    const expiresAt = sessionToken.expiresAt;

    return now > expiresAt;
  }

  /**
   * Revoke a Discord token.
   *
   * @param token The Discord token object
   */
  async revokeToken(token: DiscordAuthToken) {
    await Promise.all([
      this.revokeAccessOrRefreshToken(token, "access"),
      this.revokeAccessOrRefreshToken(token, "refresh"),
    ]);
  }

  private async revokeAccessOrRefreshToken(
    token: DiscordAuthToken,
    tokenType: "access" | "refresh"
  ) {
    const url = `${DISCORD_API_BASE_URL}${DISCORD_TOKEN_REVOCATION_ENDPOINT}`;

    const revokeAccessParams = new URLSearchParams({
      token: tokenType === "access" ? token.access_token : token.refresh_token,
      client_id: this.CLIENT_ID,
      client_secret: this.CLIENT_SECRET,
    });

    const res = await fetch(url, {
      method: "POST",
      body: revokeAccessParams,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to revoke ${tokenType} token (${res.status}): ${JSON.stringify(
          await res.json()
        )}`
      );
    }
  }

  async userManagesGuild(userAccessToken: string, guildId: string) {
    const endpoint = `/users/@me/guilds`;
    const guilds = await this.discordApiService.executeBearerRequest<
      PartialUserGuild[]
    >(userAccessToken, endpoint);

    const guildsWithPermission = guilds.filter(
      (guild) =>
        guild.owner ||
        (BigInt(guild.permissions) & MANAGE_CHANNEL) === MANAGE_CHANNEL
    );

    return guildsWithPermission.some((guild) => guild.id === guildId);
  }

  async getUser(accessToken: string) {
    const endpoint = `/users/@me`;
    const user = await this.discordApiService.executeBearerRequest<DiscordUser>(
      accessToken,
      endpoint
    );

    return user;
  }

  /**
   * Format the Discord token object to return an object containing the expiresAt field,
   * which is the time at which the token expires in seconds.
   *
   * @param tokenObject The token object returned by Discord
   * @returns The formatted token object containing expiresAt
   */
  private async attachExtraDetailsToToken(
    tokenObject: DiscordAuthToken
  ): Promise<{ newToken: SessionAccessToken; user: DiscordUser }> {
    const user = await this.getUser(tokenObject.access_token);
    const now = new Date();
    // expiresAt must be in seconds to match expire_in
    const expiresAt = Math.round(now.getTime() / 1000) + tokenObject.expires_in;

    return {
      newToken: {
        ...tokenObject,
        expiresAt,
        discord: {
          id: user.id,
        },
      },
      user,
    };
  }
}
