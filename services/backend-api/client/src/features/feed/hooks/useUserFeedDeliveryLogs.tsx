import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  GetUserFeedDeliveryLogsInput,
  GetUserFeedDeliveryLogsOutput,
  getUserFeedDeliveryLogs,
} from "../api";

interface Props {
  feedId?: string;
  data: GetUserFeedDeliveryLogsInput["data"];
}

export const useUserFeedDeliveryLogs = ({ feedId, data: inputData }: Props) => {
  const queryKey = [
    "user-feed-delivery-logs",
    {
      feedId,
      data: inputData,
    },
  ];

  const { data, status, error, fetchStatus } = useQuery<
    GetUserFeedDeliveryLogsOutput,
    ApiAdapterError | Error
  >(
    queryKey,
    async () => {
      if (!feedId) {
        throw new Error("Feed ID is required to fetch feed articles");
      }

      return getUserFeedDeliveryLogs({
        feedId,
        data: inputData,
      });
    },
    {
      enabled: !!feedId,
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
