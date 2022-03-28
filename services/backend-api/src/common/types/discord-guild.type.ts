import { DiscordGuildRole } from './discord-guild-role.type';

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string;
  roles: DiscordGuildRole[];
  owner_id: string;
}
