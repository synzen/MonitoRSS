import { FeedConnectionType, FeedDiscordWebhookConnection } from '../../../types';
import { useUserFeed } from '../../feed/hooks';

interface Props {
  feedId?: string
  connectionId?: string
}

export const useDiscordWebhookConnection = ({ feedId, connectionId }: Props) => {
  const {
    feed,
    status,
    error,
    fetchStatus,
  } = useUserFeed({ feedId });

  const connection = feed?.connections
    .find((c) => c.id === connectionId
      && c.key === FeedConnectionType.DiscordWebhook) as FeedDiscordWebhookConnection | undefined;

  return {
    connection,
    status,
    error,
    fetchStatus,
  };
};
