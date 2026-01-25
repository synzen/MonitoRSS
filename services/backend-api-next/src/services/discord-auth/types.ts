import type { DiscordUser } from "../../shared/types/discord.types";

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

export interface UserManagesGuildResult {
  isManager: boolean;
  permissions: string | null;
}

export interface CreateAccessTokenResult {
  token: SessionAccessToken;
  user: DiscordUser;
}

export interface GetAuthorizationUrlOptions {
  state?: string;
  additionalScopes?: string;
}
