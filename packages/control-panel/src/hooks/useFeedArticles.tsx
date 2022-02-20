import { useQuery } from 'react-query';
import ApiAdapterError from '../adapters/ApiAdapterError';
import getFeedArticles, { GetFeedArticlesOutput } from '../adapters/feeds/getFeedArticles';

interface Props {
  feedId?: string
}

const useFeedArticles = ({ feedId }: Props) => {
  const { data, status, error } = useQuery<
  GetFeedArticlesOutput, ApiAdapterError | Error
  >(
    ['feed-articles', {
      feedId,
    }],
    async () => {
      if (!feedId) {
        throw new Error('Missing feed selection');
      }

      return getFeedArticles({
        feedId,
      });
    },
    {
      enabled: !!feedId,
    },
  );

  return {
    articles: data?.result || [],
    status,
    error,
  };
};

export default useFeedArticles;
