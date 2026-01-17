import { GetDiscordChannelType } from "./GetDiscordChannelType";

export const discordServerQueryKeys = {
  serverMember: (serverId: string, memberId: string) =>
    ["server-member", { serverId, memberId }] as const,

  serverRoles: (serverId: string) => ["server-roles", { serverId }] as const,

  serverChannels: (serverId: string, types?: GetDiscordChannelType[]) =>
    ["server-channels", { serverId, types }] as const,

  allChannels: (serverId: string) =>
    ["server-channels", { serverId, types: [GetDiscordChannelType.All] }] as const,
};
