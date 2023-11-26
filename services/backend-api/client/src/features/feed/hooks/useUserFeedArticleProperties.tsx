import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  getUserFeedArticleProperties,
  GetUserFeedArticlePropertiesInput,
  GetUserFeedArticlePropertiesOutput,
} from "../api";

interface Props {
  feedId?: string;
  data: GetUserFeedArticlePropertiesInput["data"];
}

export const useUserFeedArticleProperties = ({ feedId, data: inputData }: Props) => {
  const queryKey = [
    "user-feed-article-properties",
    {
      feedId,
      inputData,
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
        data: inputData,
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
