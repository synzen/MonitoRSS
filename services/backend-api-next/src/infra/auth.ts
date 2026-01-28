import type { FastifyRequest, FastifyReply } from "fastify";
import type { Config } from "../config";
import logger from "./logger";
import {
  DISCORD_API_BASE_URL,
  DISCORD_AUTH_ENDPOINT,
  DISCORD_TOKEN_ENDPOINT,
  DISCORD_TOKEN_REVOCATION_ENDPOINT,
} from "../shared/constants/discord";

declare module "@fastify/secure-session" {
  interface SessionData {
    accessToken: SessionAccessToken;
    authState: string;
  }
}

export interface DiscordAuthToken {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface SessionAccessToken extends DiscordAuthToken {
  expiresAt: number;
  discord: {
    id: string;
    email?: string;
  };
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
}

export interface PartialUserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

// Discord permission flags
export const MANAGE_CHANNEL = BigInt(0x10);
export const ADMINISTRATOR = BigInt(0x8);

export interface UserManagesGuildResult {
  isManager: boolean;
  permissions: string | null;
}

export interface AuthService {
  getAuthorizationUrl(options?: {
    state?: string;
    additionalScopes?: string;
  }): string;
  createAccessToken(authorizationCode: string): Promise<{
    token: SessionAccessToken;
    user: DiscordUser;
  }>;
  refreshToken(token: DiscordAuthToken): Promise<SessionAccessToken>;
  isTokenExpired(token: SessionAccessToken): boolean;
  revokeToken(token: DiscordAuthToken): Promise<void>;
  getUser(accessToken: string): Promise<DiscordUser>;
  userManagesGuild(
    userAccessToken: string,
    guildId: string,
  ): Promise<UserManagesGuildResult>;
}

export function createAuthService(config: Config): AuthService {
  const OAUTH_SCOPES = "identify guilds";
  const CLIENT_ID = config.BACKEND_API_DISCORD_CLIENT_ID;
  const CLIENT_SECRET = config.BACKEND_API_DISCORD_CLIENT_SECRET;
  const OAUTH_REDIRECT_URI = config.BACKEND_API_DISCORD_REDIRECT_URI;

  async function getUser(accessToken: string): Promise<DiscordUser> {
    const url = `${DISCORD_API_BASE_URL}/users/@me`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to get user (${res.status})`);
    }

    return res.json() as Promise<DiscordUser>;
  }

  async function attachExtraDetailsToToken(
    tokenObject: DiscordAuthToken,
  ): Promise<{ newToken: SessionAccessToken; user: DiscordUser }> {
    const user = await getUser(tokenObject.access_token);
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

  async function revokeAccessOrRefreshToken(
    token: DiscordAuthToken,
    tokenType: "access" | "refresh",
  ): Promise<void> {
    const url = `${DISCORD_API_BASE_URL}${DISCORD_TOKEN_REVOCATION_ENDPOINT}`;

    const revokeParams = new URLSearchParams({
      token: tokenType === "access" ? token.access_token : token.refresh_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const res = await fetch(url, {
      method: "POST",
      body: revokeParams,
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

  return {
    getAuthorizationUrl(options) {
      return (
        `${DISCORD_API_BASE_URL}${DISCORD_AUTH_ENDPOINT}?response_type=code` +
        `&client_id=${CLIENT_ID}` +
        `&scope=${OAUTH_SCOPES}${options?.additionalScopes || ""}` +
        `&redirect_uri=${OAUTH_REDIRECT_URI}` +
        `&prompt=consent${options?.state ? `&state=${options.state}` : ""}`
      );
    },

    async createAccessToken(authorizationCode: string) {
      const url = `${DISCORD_API_BASE_URL}${DISCORD_TOKEN_ENDPOINT}`;

      const searchParams = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: authorizationCode,
        redirect_uri: OAUTH_REDIRECT_URI,
        scope: OAUTH_SCOPES,
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
      const { newToken, user } = await attachExtraDetailsToToken(tokenObject);

      return { token: newToken, user };
    },

    async refreshToken(token: DiscordAuthToken) {
      const url = `${DISCORD_API_BASE_URL}${DISCORD_TOKEN_ENDPOINT}`;

      const searchParams = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
        redirect_uri: OAUTH_REDIRECT_URI,
        scope: OAUTH_SCOPES,
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
      const { newToken } = await attachExtraDetailsToToken(tokenObject);

      return newToken;
    },

    isTokenExpired(sessionToken: SessionAccessToken) {
      const now = new Date().getTime() / 1000;
      return now > sessionToken.expiresAt;
    },

    async revokeToken(token: DiscordAuthToken) {
      await Promise.all([
        revokeAccessOrRefreshToken(token, "access"),
        revokeAccessOrRefreshToken(token, "refresh"),
      ]);
    },

    async userManagesGuild(
      userAccessToken: string,
      guildId: string,
    ): Promise<UserManagesGuildResult> {
      const url = `${DISCORD_API_BASE_URL}/users/@me/guilds`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to get user guilds (${res.status})`);
      }

      const guilds = (await res.json()) as PartialUserGuild[];
      const targetGuild = guilds.find((g) => g.id === guildId);

      if (!targetGuild) {
        return {
          isManager: false,
          permissions: null,
        };
      }

      const permissions = BigInt(targetGuild.permissions);
      const isManager =
        targetGuild.owner ||
        (permissions & MANAGE_CHANNEL) === MANAGE_CHANNEL ||
        (permissions & ADMINISTRATOR) === ADMINISTRATOR;

      return {
        isManager,
        permissions: targetGuild.permissions,
      };
    },

    getUser,
  };
}

export function getAccessTokenFromRequest(
  request: FastifyRequest,
): SessionAccessToken | undefined {
  return request.session.get("accessToken") as SessionAccessToken | undefined;
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  authService: AuthService,
): Promise<SessionAccessToken | null> {
  let token = getAccessTokenFromRequest(request);

  if (!token) {
    reply.status(401).send({ message: "Unauthorized" });
    return null;
  }

  if (authService.isTokenExpired(token)) {
    try {
      token = await authService.refreshToken(token);
      request.session.set("accessToken", token);
    } catch (err) {
      logger.error("Failed to refresh token", { error: (err as Error).stack });
      reply.status(401).send({ message: "Token refresh failed" });
      return null;
    }
  }

  return token;
}

/**
 * PreHandler hook that checks if the user has MANAGE_CHANNEL permission on the specified guild.
 * Must be used after requireAuth.
 *
 * @param guildIdExtractor - Function to extract guild ID from request (e.g., from params or body)
 */
export function requireServerPermission(
  guildIdExtractor: (request: FastifyRequest) => string | undefined,
) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const token = getAccessTokenFromRequest(request);

    if (!token) {
      reply.status(401).send({ message: "Unauthorized" });
      return;
    }

    const guildId = guildIdExtractor(request);

    if (!guildId) {
      reply.status(400).send({ message: "Guild ID is required" });
      return;
    }

    const authService = request.container.authService;
    const result = await authService.userManagesGuild(
      token.access_token,
      guildId,
    );

    if (!result.isManager) {
      reply.status(403).send({
        message: "You do not have permission to manage this server",
      });
      return;
    }
  };
}
