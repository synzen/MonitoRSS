import { FeedConnectionType, FeedDiscordChannelConnection } from "../types";

export function getConnectionDestinationLabel(
  channelType?: string | null,
  webhookType?: string | null,
): string {
  const type = channelType || webhookType;

  switch (type) {
    case "forum":
      return "Forum";
    case "thread":
    case "forum-thread":
      return "Thread";
    case "new-thread":
    default:
      return "Channel";
  }
}

export function getPrettyConnectionName(connection: FeedDiscordChannelConnection) {
  const { key } = connection;

  if (key === FeedConnectionType.DiscordChannel) {
    const casted = connection as FeedDiscordChannelConnection;
    const channelType = casted.details.channel?.type;
    const webhookType = casted.details.webhook?.type;
    const label = getConnectionDestinationLabel(channelType, webhookType);

    if (channelType === "new-thread") {
      return "Discord Channel (New threads)";
    }

    return `Discord ${label}`;
  }

  return "Unknown";
}
