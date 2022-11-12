export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  // A snowflake of the user avatar
  avatar: string | null;
}

export type DiscordUserFormatted = DiscordUser & {
  // "avar" field on DiscordUser formatted into a url
  avatarUrl?: string;
  maxFeeds: number;
  supporter?: {
    maxFeeds: number;
    guilds: string[];
    maxGuilds: number;
    expireAt?: Date;
  };
};
