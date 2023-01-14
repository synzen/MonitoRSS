import { useState } from "react";
import { GetUserFeedArticlesInput } from "../api";
import { useUserFeedArticles } from "./useUserFeedArticles";

interface Props {
  feedId?: string;
  limit?: number;
  data: Omit<GetUserFeedArticlesInput["data"], "skip" | "limit">;
}

export const useUserFeedArticlesWithPagination = ({ feedId, limit, data: inputData }: Props) => {
  const [skip, setSkip] = useState(0);
  const useLimit = limit || 10;

  const { error, data, status, fetchStatus } = useUserFeedArticles({
    feedId,
    data: {
      ...inputData,
      skip,
      limit: useLimit,
    },
  });

  const nextPage = () => {
    setSkip(skip + useLimit);
  };

  const prevPage = () => {
    setSkip(skip - useLimit);
  };

  return {
    data,
    error,
    status,
    fetchStatus,
    nextPage,
    prevPage,
    skip,
    limit: useLimit,
  };
};
