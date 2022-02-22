import { DiscordRole } from './DiscordRole';

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string;
  roles: DiscordRole[];
}
