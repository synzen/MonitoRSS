import { URLSearchParams } from "url";
import type { Config } from "../../config";
import {
  DISCORD_API_BASE_URL,
  DISCORD_AUTH_ENDPOINT,
  DISCORD_TOKEN_ENDPOINT,
  DISCORD_TOKEN_REVOCATION_ENDPOINT,
} from "../../shared/constants/discord";
import { MANAGE_CHANNEL } from "../../shared/constants/discord-permissions";
import type {
  DiscordUser,
  PartialUserGuild,
} from "../../shared/types/discord.types";
import type { DiscordApiService } from "../discord-api/discord-api.service";
import type {
  CreateAccessTokenResult,
  DiscordAuthToken,
  GetAuthorizationUrlOptions,
  SessionAccessToken,
  UserManagesGuildResult,
} from "./types";

export class DiscordAuthService {
  private readonly OAUTH_SCOPES = "identify guilds";
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly config: Config,
    private readonly discordApiService: DiscordApiService,
  ) {
    this.clientId = config.BACKEND_API_DISCORD_CLIENT_ID;
    this.clientSecret = config.BACKEND_API_DISCORD_CLIENT_SECRET;
    this.redirectUri = config.BACKEND_API_DISCORD_REDIRECT_URI;
  }

  getAuthorizationUrl(options?: GetAuthorizationUrlOptions): string {
    return (
      `${DISCORD_API_BASE_URL}/${DISCORD_AUTH_ENDPOINT}?response_type=code` +
      `&client_id=${this.clientId}&scope=${`${this.OAUTH_SCOPES}${
        options?.additionalScopes || ""
      }`}&` +
      `redirect_uri=${this.redirectUri}&prompt=consent${
        options?.state ? `&state=${options.state}` : ""
      }`
    );
  }

  async createAccessToken(
    authorizationCode: string,
  ): Promise<CreateAccessTokenResult> {
    const url = `${DISCORD_API_BASE_URL}${DISCORD_TOKEN_ENDPOINT}`;

    const searchParams = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "authorization_code",
      code: authorizationCode,
      redirect_uri: this.redirectUri,
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

    const { newToken, user } =
      await this.attachExtraDetailsToToken(tokenObject);

    return { token: newToken, user };
  }

  async refreshToken(token: DiscordAuthToken): Promise<SessionAccessToken> {
    const url = `${DISCORD_API_BASE_URL}${DISCORD_TOKEN_ENDPOINT}`;

    const searchParams = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
      redirect_uri: this.redirectUri,
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

    const { newToken } = await this.attachExtraDetailsToToken(tokenObject);

    return newToken;
  }

  isTokenExpired(sessionToken: SessionAccessToken): boolean {
    const now = new Date().getTime() / 1000;
    const expiresAt = sessionToken.expiresAt;

    return now > expiresAt;
  }

  async revokeToken(token: DiscordAuthToken): Promise<void> {
    await Promise.all([
      this.revokeAccessOrRefreshToken(token, "access"),
      this.revokeAccessOrRefreshToken(token, "refresh"),
    ]);
  }

  async userManagesGuild(
    userAccessToken: string,
    guildId: string,
  ): Promise<UserManagesGuildResult> {
    const endpoint = `/users/@me/guilds`;
    const guilds = await this.discordApiService.executeBearerRequest<
      PartialUserGuild[]
    >(userAccessToken, endpoint);

    const targetGuild = guilds.find((g) => g.id === guildId);

    if (!targetGuild) {
      return {
        isManager: false,
        permissions: null,
      };
    }

    const isManager =
      targetGuild.owner ||
      (BigInt(targetGuild.permissions) & MANAGE_CHANNEL) === MANAGE_CHANNEL;

    return {
      isManager,
      permissions: targetGuild.permissions,
    };
  }

  async getUser(accessToken: string): Promise<DiscordUser> {
    const endpoint = `/users/@me`;
    const user = await this.discordApiService.executeBearerRequest<DiscordUser>(
      accessToken,
      endpoint,
    );

    return user;
  }

  private async revokeAccessOrRefreshToken(
    token: DiscordAuthToken,
    tokenType: "access" | "refresh",
  ): Promise<void> {
    const url = `${DISCORD_API_BASE_URL}${DISCORD_TOKEN_REVOCATION_ENDPOINT}`;

    const revokeAccessParams = new URLSearchParams({
      token: tokenType === "access" ? token.access_token : token.refresh_token,
      client_id: this.clientId,
      client_secret: this.clientSecret,
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
          await res.json(),
        )}`,
      );
    }
  }

  private async attachExtraDetailsToToken(
    tokenObject: DiscordAuthToken,
  ): Promise<{ newToken: SessionAccessToken; user: DiscordUser }> {
    const user = await this.getUser(tokenObject.access_token);
    const now = new Date();
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
