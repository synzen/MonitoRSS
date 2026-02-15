import { useQuery, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { getUserFeed, GetUserFeedOutput } from "../api";
import { Feed } from "@/types";

interface Props {
  feedId?: string;
}

export const useUserFeed = ({ feedId }: Props) => {
  const queryClient = useQueryClient();
  const queryKey = [
    "user-feed",
    {
      feedId,
    },
  ];

  const { data, status, error, refetch, fetchStatus } = useQuery<
    GetUserFeedOutput,
    ApiAdapterError | Error
  >(
    queryKey,
    async () => {
      if (!feedId) {
        throw new Error("Missing feed selection");
      }

      return getUserFeed({
        feedId,
      });
    },
    {
      enabled: !!feedId,
    },
  );

  const updateCache = (details: Partial<Feed>) => {
    if (!data) {
      return;
    }

    queryClient.setQueryData<GetUserFeedOutput>(queryKey, {
      result: {
        ...data.result,
        ...details,
      },
    });
  };

  return {
    feed: data?.result,
    status,
    error,
    refetch,
    updateCache,
    fetchStatus,
  };
};
