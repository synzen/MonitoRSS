import { FeedConnectionType, FeedDiscordChannelConnection } from "../types";

export function getPrettyConnectionName(connection: FeedDiscordChannelConnection) {
  const { key } = connection;

  if (key === FeedConnectionType.DiscordChannel) {
    const casted = connection as FeedDiscordChannelConnection;

    if (casted.details.channel) {
      if (casted.details.channel.type === "new-thread") {
        return "Discord Channel (New threads)";
      }

      if (casted.details.channel.type === "thread") {
        return "Discord Thread";
      }

      if (casted.details.channel.type === "forum") {
        return "Discord Forum";
      }

      return "Discord Channel";
    }

    if (casted.details.webhook) {
      if (casted.details.webhook.type === "forum") {
        return "Discord Forum Webhook";
      }

      if (casted.details.webhook.type === "thread") {
        return "Discord Thread Webhook";
      }

      return "Discord Channel Webhook";
    }
  }

  return "Unknown";
}
