import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ThemedSelect } from '@/components';
import { useFeeds } from '../../hooks/useFeeds';

interface Props {

}

export const FeedSearchSelect: React.FC<Props> = () => {
  const navigate = useNavigate();
  const { serverId, feedId } = useParams();
  const { pathname } = useLocation();

  const { status, data } = useFeeds({ serverId });

  const loading = status === 'idle' || status === 'loading';

  const onChangedValue = (newFeedId: string) => {
    if (!feedId) {
      return;
    }

    navigate(pathname.replace(feedId, newFeedId));
  };

  return (
    <ThemedSelect
      onChangedValue={onChangedValue}
      loading={loading}
      selectedValue={feedId}
      options={data?.results.map((feed) => ({
        value: feed.id,
        label: feed.title,
      })) || []}
    />
  );
};
