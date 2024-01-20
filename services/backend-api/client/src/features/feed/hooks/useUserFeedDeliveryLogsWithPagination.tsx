import { useState } from "react";
import { GetUserFeedDeliveryLogsInput } from "../api";
import { useUserFeedDeliveryLogs } from "./useUserFeedDeliveryLogs";

interface Props {
  feedId?: string;
  limit?: number;
  data: Omit<GetUserFeedDeliveryLogsInput["data"], "skip" | "limit">;
}

export const useUserFeedDeliveryLogsWithPagination = ({
  feedId,
  limit,
  data: inputData,
}: Props) => {
  const [skip, setSkip] = useState(0);
  const useLimit = limit || 10;

  const { error, data, status, fetchStatus } = useUserFeedDeliveryLogs({
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
