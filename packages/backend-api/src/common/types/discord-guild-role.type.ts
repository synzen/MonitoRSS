export interface DiscordGuildRole {
  id: string;
  name: string;
  permissions: string;
  position: number;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  icon?: string;
  unicode_emoji?: string;
}
