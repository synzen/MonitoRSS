interface ChannelPermissionOverwrite {
  id: string;
  type: "role" | "member";
  allow: string;
  deny: string;
}

export enum DiscordChannelType {
  GUILD_TEXT = 0,
  GUILD_CATEGORY = 4,
  GUILD_ANNOUNCEMENT = 5,
  GUILD_FORUM = 15,
}

export interface DiscordGuildChannel {
  id: string;
  name: string;
  guild_id: string;
  permission_overwrites: ChannelPermissionOverwrite[];
  type: DiscordChannelType;
  parent_id: string | null;
}
