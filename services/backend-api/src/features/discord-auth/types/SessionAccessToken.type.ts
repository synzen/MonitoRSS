import { DiscordAuthToken } from "../discord-auth.service";

export type SessionAccessToken = DiscordAuthToken & {
  /**
   * The time at which the token expires in seconds.
   */
  expiresAt: number;
  discord: {
    id: string;
    email?: string;
  };
};
