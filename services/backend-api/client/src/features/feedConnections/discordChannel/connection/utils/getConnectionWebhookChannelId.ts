import { FeedDiscordChannelConnection } from "@/types";

const THREAD_TYPES = new Set(["thread", "forum-thread"]);

export function getConnectionWebhookChannelId(
  connection: Pick<FeedDiscordChannelConnection, "details">,
): string | undefined {
  return (
    connection.details.webhook?.channelId ||
    connection.details.channel?.parentChannelId ||
    connection.details.channel?.id
  );
}

export function getConnectionWebhookThreadId(
  connection: Pick<FeedDiscordChannelConnection, "details">,
): string | undefined {
  return (
    connection.details.webhook?.threadId ||
    (connection.details.channel?.type && THREAD_TYPES.has(connection.details.channel.type)
      ? connection.details.channel.id
      : undefined)
  );
}
