export interface DiscordBotUser {
  id: string;
  username: string;
  avatar: string | null;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
}

export interface DiscordUserFormatted {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  avatarUrl?: string;
  email?: string;
  maxFeeds: number;
  maxUserFeeds: number;
  maxUserFeedsComposition: {
    base: number;
    legacy: number;
  };
  allowCustomPlaceholders?: boolean;
  supporter?: {
    guilds: string[];
    maxFeeds: number;
    maxGuilds: number;
    expireAt?: Date;
  };
}

export interface PartialUserGuild {
  id: string;
  name: string;
  icon?: string;
  owner: boolean;
  permissions: string;
}

export interface PartialUserGuildFormatted extends PartialUserGuild {
  iconUrl?: string;
  benefits: {
    maxFeeds: number;
    webhooks: boolean;
  };
}

export interface UpdateSupporterInput {
  guildIds?: string[];
}

export interface GetGuildsOptions {
  guildIconSize?: string;
  guildIconFormat?: "png" | "jpeg" | "webp" | "gif";
}
