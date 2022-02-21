export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
}

export type DiscordUserFormatted = DiscordUser & {
  avatarUrl?: string;
};
