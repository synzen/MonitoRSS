import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { GetUserFeedRequestsInput, GetUserFeedRequestsOutput, getUserFeedRequests } from "../api";

interface Props {
  feedId?: string;
  data: GetUserFeedRequestsInput["data"];
  disabled?: boolean;
}

export const useUserFeedRequests = ({ feedId, data: inputData, disabled }: Props) => {
  const queryKey = [
    "user-feed-requests",
    {
      feedId,
      data: inputData,
    },
  ];

  const { data, status, error, fetchStatus } = useQuery<
    GetUserFeedRequestsOutput,
    ApiAdapterError | Error
  >(
    queryKey,
    async () => {
      if (!feedId) {
        throw new Error("Feed ID is required to fetch feed articles");
      }

      return getUserFeedRequests({
        feedId,
        data: inputData,
      });
    },
    {
      enabled: !!feedId && !disabled,
      keepPreviousData: true,
      refetchOnWindowFocus: true,
    },
  );

  return {
    data,
    status,
    error,
    fetchStatus,
  };
};
