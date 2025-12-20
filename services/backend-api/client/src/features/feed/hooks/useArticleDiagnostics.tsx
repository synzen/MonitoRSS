import { useInfiniteQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  GetArticleDiagnosticsInput,
  GetArticleDiagnosticsOutput,
  getArticleDiagnostics,
} from "../api/getArticleDiagnostics";

interface Props {
  feedId?: string;
  data: GetArticleDiagnosticsInput["data"];
  disabled?: boolean;
}

export const useArticleDiagnostics = ({ feedId, data: inputData, disabled }: Props) => {
  const queryKey = [
    "article-diagnostics",
    {
      feedId,
      data: inputData,
    },
  ];

  const { data, status, error, fetchStatus, refetch, dataUpdatedAt, fetchNextPage, hasNextPage } =
    useInfiniteQuery<GetArticleDiagnosticsOutput, ApiAdapterError | Error>(
      queryKey,
      async ({ pageParam: skip }) => {
        if (!feedId) {
          throw new Error("Feed ID is required to fetch article diagnostics");
        }

        return getArticleDiagnostics({
          feedId,
          data: {
            ...inputData,
            skip,
          },
        });
      },
      {
        enabled: !!feedId && !disabled,
        keepPreviousData: true,
        refetchOnWindowFocus: false,
        getNextPageParam: (lastPage, allPages) => {
          if (lastPage.result.results.length < inputData.limit) {
            return undefined;
          }

          return allPages.length * inputData.limit;
        },
      }
    );

  return {
    data,
    status,
    error,
    fetchStatus,
    refetch,
    dataUpdatedAt,
    fetchNextPage,
    hasNextPage,
  };
};
