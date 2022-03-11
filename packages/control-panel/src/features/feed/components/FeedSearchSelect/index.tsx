import { useNavigate, useParams } from 'react-router-dom';
import { ThemedSelect } from '@/components';
import { useFeeds } from '../../hooks/useFeeds';

interface Props {

}

export const FeedSearchSelect: React.FC<Props> = () => {
  const navigate = useNavigate();
  const { serverId, feedId } = useParams();

  const { status, data, isFetchingDifferentServer } = useFeeds({ serverId });

  const loading = status === 'idle' || status === 'loading' || isFetchingDifferentServer;

  const onChangedValue = (newFeedId: string) => {
    navigate(`/servers/${serverId}/feeds/${newFeedId}`);
  };

  return (
    <ThemedSelect
      onChange={onChangedValue}
      loading={loading}
      value={feedId}
      options={data?.results.map((feed) => ({
        value: feed.id,
        label: feed.title,
      })) || []}
    />
  );
};
