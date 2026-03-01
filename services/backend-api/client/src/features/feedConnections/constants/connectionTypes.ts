export type ConnectionType = "discord-channel";

export const CONNECTION_TYPES: Array<{
  type: ConnectionType;
  label: string;
  description: string;
}> = [
  {
    type: "discord-channel",
    label: "Discord Connection",
    description: "Send articles as messages to a Discord channel or forum.",
  },
];
