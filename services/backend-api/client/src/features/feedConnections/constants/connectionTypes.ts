export type ConnectionType = "discord-channel" | "discord-forum" | "discord-webhook";

export const CONNECTION_TYPES: Array<{
  type: ConnectionType;
  label: string;
  description: string;
}> = [
  {
    type: "discord-channel",
    label: "Discord Channel",
    description: "Send articles as messages authored by the bot to a Discord channel.",
  },
  {
    type: "discord-forum",
    label: "Discord Forum",
    description: "Send articles as messages authored by the bot to a Discord forum.",
  },
  {
    type: "discord-webhook",
    label: "Discord Webhook",
    description: "Send articles as messages authored by a webhook with a custom name and avatar.",
  },
];
