export interface MemberPermissionDetails {
  roles: string[];
  user: {
    id: string;
  };
}

export interface ChannelPermissionDetails {
  guild_id: string;
  permission_overwrites: Array<{
    id: string;
    allow: string;
    deny: string;
  }>;
}

export interface GuildPermissionDetails {
  id: string;
  owner_id: string;
  roles: Array<{
    id: string;
    permissions: string;
  }>;
}
