import { useQuery } from 'react-query';
import ApiAdapterError from '../adapters/ApiAdapterError';
import getFeedArticles from '../adapters/feeds/getFeedArticles';
import { FeedArticle } from '../types/FeedArticle';

interface Props {
  feedId?: string
}

interface UseFeedArticlesData {
  articles: FeedArticle[]
}

const useFeedArticles = ({ feedId }: Props) => {
  const { data, status, error } = useQuery<
  UseFeedArticlesData, ApiAdapterError | Error
  >(
    ['feed-articles', {
      feedId,
    }],
    async () => {
      if (!feedId) {
        throw new Error('Missing feed selection');
      }

      const response = await getFeedArticles({
        feedId,
      });

      return {
        articles: response.result,
      };
    },
    {
      enabled: !!feedId,
    },
  );

  return {
    articles: data?.articles || [],
    status,
    error,
  };
};

export default useFeedArticles;
