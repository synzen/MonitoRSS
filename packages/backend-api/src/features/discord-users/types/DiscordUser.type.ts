export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export type DiscordUserFormatted = DiscordUser & {
  avatarUrl?: string;
  supporter?: {
    maxFeeds: number;
    guilds: string[];
    maxGuilds: number;
    expireAt?: Date;
  };
};
