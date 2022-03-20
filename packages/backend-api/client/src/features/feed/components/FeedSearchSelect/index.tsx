import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ThemedSelect } from '@/components';
import { useFeeds } from '../../hooks/useFeeds';
import { debounce } from 'lodash';

interface Props {

}

export const FeedSearchSelect: React.FC<Props> = () => {
  const navigate = useNavigate();
  const { serverId, feedId } = useParams();
  const { pathname } = useLocation();

  const { status, data, setSearch } = useFeeds({ serverId });

  const loading = status === 'idle' || status === 'loading';

  const onChangedValue = (newFeedId: string) => {
    if (feedId) {
      navigate(pathname.replace(feedId, newFeedId));
    } else {
      navigate(`/servers/${serverId}/feeds/${newFeedId}/message`);
    }
  };

  const onSearchChange = debounce((value: string) => {
    setSearch(value);
  }, 500);

  return (
    <ThemedSelect
      onChange={onChangedValue}
      loading={loading}
      value={feedId}
      onInputChange={onSearchChange}
      options={data?.results.map((feed) => ({
        value: feed.id,
        label: feed.title,
      })) || []}
    />
  );
};
