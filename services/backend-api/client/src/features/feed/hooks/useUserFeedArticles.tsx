import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { getUserFeedArticles, GetUserFeedArticlesInput, GetUserFeedArticlesOutput } from "../api";
import { DiscordFormatOptions } from "../../../types/DiscordFormatOptions";

export interface UseUserFeedArticlesProps {
  feedId?: string;
  data: Omit<GetUserFeedArticlesInput["data"], "formatter"> & {
    formatOptions: DiscordFormatOptions;
  };
  onSuccess?: (data: GetUserFeedArticlesOutput) => void;
  disabled?: boolean;
}

export const useUserFeedArticles = ({
  feedId,
  data: inputData,
  onSuccess,
  disabled,
}: UseUserFeedArticlesProps) => {
  const queryKey = [
    "user-feed-articles",
    {
      feedId,
      inputData,
    },
  ];

  const { data, status, error, refetch, fetchStatus } = useQuery<
    GetUserFeedArticlesOutput,
    ApiAdapterError | Error,
    GetUserFeedArticlesOutput
  >(
    queryKey,
    async () => {
      if (!feedId) {
        throw new Error("Feed ID is required to fetch feed articles");
      }

      const { formatOptions, ...rest } = inputData;

      return getUserFeedArticles({
        feedId,
        data: {
          ...rest,
          formatter: {
            customPlaceholders: formatOptions.customPlaceholders,
            externalProperties: formatOptions.externalProperties,
            options: {
              dateFormat: formatOptions.dateFormat,
              dateTimezone: formatOptions.dateTimezone,
              disableImageLinkPreviews: formatOptions.disableImageLinkPreviews,
              formatTables: formatOptions.formatTables,
              ignoreNewLines: formatOptions.ignoreNewLines,
              stripImages: formatOptions.stripImages,
            },
          },
        },
      });
    },
    {
      enabled: !!feedId && !!inputData.selectProperties?.length && !disabled,
      onSuccess,
      keepPreviousData: true,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  );

  return {
    data,
    status,
    error,
    refetch,
    fetchStatus,
  };
};
