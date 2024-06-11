import { useState } from "react";
import { GetUserFeedRequestsInput } from "../api";
import { useUserFeedRequests } from "./useUserFeedRequests";

interface Props {
  feedId?: string;
  limit?: number;
  data: Omit<GetUserFeedRequestsInput["data"], "skip" | "limit">;
  disabled?: boolean;
}

export const useUserFeedRequestsWithPagination = ({
  feedId,
  limit,
  data: inputData,
  disabled,
}: Props) => {
  const [skip, setSkip] = useState(0);
  const useLimit = limit || 10;

  const { error, data, status, fetchStatus } = useUserFeedRequests({
    feedId,
    data: {
      ...inputData,
      skip,
      limit: useLimit,
    },
    disabled,
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
