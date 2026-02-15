import { FeedConnectionType, FeedDiscordChannelConnection } from "../../../types";
import { useUserFeed } from "../../feed/hooks";

interface Props {
  feedId?: string;
  connectionId?: string;
}

export const useDiscordChannelConnection = ({ feedId, connectionId }: Props) => {
  const { feed, status, error, fetchStatus } = useUserFeed({
    feedId,
  });

  const connection = feed?.connections.find(
    (c) => c.id === connectionId && c.key === FeedConnectionType.DiscordChannel,
  ) as FeedDiscordChannelConnection | undefined;

  return {
    connection,
    status,
    error,
    fetchStatus,
  };
};
