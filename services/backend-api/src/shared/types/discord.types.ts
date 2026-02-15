export interface DiscordUser {
  id: string;
  email?: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export interface DiscordGuildMember {
  roles: string[];
  nick?: string | null;
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
}

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

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string;
  roles: DiscordGuildRole[];
  owner_id: string;
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

interface ChannelPermissionOverwrite {
  id: string;
  type: "role" | "member";
  allow: string;
  deny: string;
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

export enum DiscordWebhookType {
  INCOMING = 1,
  CHANNEL_FOLLOWER = 2,
  APPLICATION = 3,
}

export interface DiscordWebhook {
  id: string;
  type: DiscordWebhookType;
  channel_id: string;
  name: string;
  avatar?: string | null;
  token?: string;
  application_id?: string | null;
  guild_id?: string;
}

export interface PartialUserGuild {
  id: string;
  name: string;
  icon?: string;
  owner: boolean;
  permissions: string;
}
