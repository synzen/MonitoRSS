import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { getUserFeedArticleProperties, GetUserFeedArticlePropertiesOutput } from "../api";

interface Props {
  feedId?: string;
}

export const useUserFeedArticleProperties = ({ feedId }: Props) => {
  const queryKey = [
    "user-feed-article-properties",
    {
      feedId,
    },
  ];

  const { data, status, error, fetchStatus } = useQuery<
    GetUserFeedArticlePropertiesOutput,
    ApiAdapterError | Error
  >(
    queryKey,
    async () => {
      if (!feedId) {
        throw new Error("Feed ID is required to fetch feed articles");
      }

      return getUserFeedArticleProperties({
        feedId,
      });
    },
    {
      enabled: !!feedId,
    }
  );

  return {
    data,
    status,
    error,
    fetchStatus,
  };
};
