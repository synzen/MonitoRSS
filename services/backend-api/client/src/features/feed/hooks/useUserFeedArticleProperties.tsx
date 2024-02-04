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
  isDisabled?: boolean;
}

export const useUserFeedArticleProperties = ({ feedId, data: inputData, isDisabled }: Props) => {
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
      enabled: !!feedId && !isDisabled,
    }
  );

  return {
    data,
    status,
    error,
    fetchStatus,
  };
};
