import { ActivityType } from '@discordjs/core';

export enum DiscordPresenceActivityType {
  Playing = 'playing',
  Streaming = 'streaming',
  Listening = 'listening',
  Watching = 'watching',
  CustomStatus = 'custom_status',
  Competing = 'competing',
}

export const DISCORD_PRESENCE_ACTIVITY_TYPE_IDS: Record<
  DiscordPresenceActivityType,
  number
> = {
  [DiscordPresenceActivityType.Playing]: ActivityType.Playing,
  [DiscordPresenceActivityType.Streaming]: ActivityType.Streaming,
  [DiscordPresenceActivityType.Listening]: ActivityType.Listening,
  [DiscordPresenceActivityType.Watching]: ActivityType.Watching,
  [DiscordPresenceActivityType.CustomStatus]: ActivityType.Custom,
  [DiscordPresenceActivityType.Competing]: ActivityType.Competing,
};
