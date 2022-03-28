import { useState } from 'react';
import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getFeedArticles, GetFeedArticlesOutput } from '../api';

interface Props {
  feedId?: string
}

export const useFeedArticles = ({ feedId }: Props) => {
  const [hasErrored, setHasErrored] = useState(false);

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
      enabled: !!feedId && !hasErrored,
      onError: () => {
        setHasErrored(true);
      },
    },
  );

  return {
    articles: data?.result || [],
    status,
    error,
  };
};
