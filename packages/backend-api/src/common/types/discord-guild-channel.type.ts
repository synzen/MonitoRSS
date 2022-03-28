interface ChannelPermissionOverwrite {
  id: string;
  type: 'role' | 'member';
  allow: string;
  deny: string;
}

export interface DiscordGuildChannel {
  id: string;
  name: string;
  guild_id: string;
  permission_overwrites: ChannelPermissionOverwrite[];
}
