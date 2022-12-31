import { useState } from 'react';
import {
  GetUserFeedArticlesInput,
} from '../api';
import { useUserFeedArticles } from './useUserFeedArticles';

interface Props {
  feedId?: string
  data: Omit<GetUserFeedArticlesInput['data'], 'skip' | 'limit'>
}

export const useUserFeedArticlesWithLoadMore = (
  { feedId, data: inputData }: Props,
) => {
  const [allArticles, setAllArticles] = useState<Array<Record<string, string>>>([]);
  const [allArticleFilterResults, setAllArticleFilterResults] = useState<
  Array<{ passed: boolean }>
  >([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 1;

  const {
    error,
    data,
    status,
    fetchStatus,
  } = useUserFeedArticles({
    feedId,
    data: {
      ...inputData,
      skip,
      limit,
    },
    onSuccess: (fetchedData) => {
      if (fetchedData.result.articles.length === 0) {
        setHasMore(false);
      } else {
        const newAllArticles = [...allArticles, ...fetchedData.result.articles];

        const newAllArticleFilterResults = [
          ...allArticleFilterResults,
          ...fetchedData.result.filterStatuses,
        ];

        setAllArticles(newAllArticles);
        setAllArticleFilterResults(newAllArticleFilterResults);
      }
    },
  });

  const loadMore = () => {
    console.log('fe');
    setSkip(skip + limit);
  };

  return {
    data,
    allArticles,
    allArticleFilterResults,
    error,
    status,
    fetchStatus,
    hasMore,
    loadMore,
  };
};
