import { useParams } from 'react-router-dom';
import { DashboardContentV2 } from '../components/DashboardContentV2';
import { useFeed } from '../features/feed';
import { ConnectionDiscordWebhookSettings } from '../features/feedConnections';
import RouteParams from '../types/RouteParams';

export const FeedMediumSettings: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const {
    status, error,
  } = useFeed({
    feedId,
  });

  return (
    <DashboardContentV2
      error={error}
      loading={status === 'loading' || status === 'idle'}
    >
      {/* <DiscordChannelSettings /> */}
      <ConnectionDiscordWebhookSettings />
    </DashboardContentV2>
  );
};
