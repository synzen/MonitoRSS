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
