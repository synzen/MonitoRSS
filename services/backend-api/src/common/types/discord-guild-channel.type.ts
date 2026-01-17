interface ChannelPermissionOverwrite {
  id: string;
  type: "role" | "member";
  allow: string;
  deny: string;
}

export enum DiscordChannelType {
  GUILD_TEXT = 0,
  GUILD_VOICE = 2,
  GUILD_CATEGORY = 4,
  GUILD_ANNOUNCEMENT = 5,
  GUILD_FORUM = 15,
  ANNOUNCEMENT_THREAD = 10,
  PUBLIC_THREAD = 11,
  PRIVATE_THREAD = 12,
}

export interface DiscordGuildChannel {
  id: string;
  name: string;
  guild_id: string;
  permission_overwrites: ChannelPermissionOverwrite[];
  type: DiscordChannelType;
  parent_id: string | null;
  available_tags?: Array<{
    id: string;
    name: string;
    moderated: boolean;
    emoji_id: string | null;
    emoji_name: string | null;
  }>;
}
