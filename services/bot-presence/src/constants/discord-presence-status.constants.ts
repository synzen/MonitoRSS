import { PresenceUpdateStatus } from '@discordjs/core';

export enum DiscordPresenceStatus {
  Online = 'online',
  Idle = 'idle',
  DoNotDisturb = 'dnd',
  Invisible = 'invisible',
  Offline = 'offline',
}

export const DISCORD_PRESENCE_STATUS_TO_API_VALUE: Record<
  DiscordPresenceStatus,
  PresenceUpdateStatus
> = {
  [DiscordPresenceStatus.Online]: PresenceUpdateStatus.Online,
  [DiscordPresenceStatus.Idle]: PresenceUpdateStatus.Idle,
  [DiscordPresenceStatus.DoNotDisturb]: PresenceUpdateStatus.DoNotDisturb,
  [DiscordPresenceStatus.Invisible]: PresenceUpdateStatus.Invisible,
  [DiscordPresenceStatus.Offline]: PresenceUpdateStatus.Offline,
};
