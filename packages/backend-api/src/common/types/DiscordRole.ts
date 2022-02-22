export interface DiscordRole {
  id: string;
  name: string;
  permissions: number;
  position: number;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  icon?: string;
  unicode_emoji?: string;
}
