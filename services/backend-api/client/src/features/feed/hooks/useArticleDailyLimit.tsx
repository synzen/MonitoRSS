import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { getArticleDailyLimit, GetArticleDailyLimitOutput } from "../api";

interface Props {
  feedId?: string;
}

export const useArticleDailyLimit = ({ feedId }: Props) => {
  const queryKey = [
    "article-daily-limit",
    {
      feedId,
    },
  ];

  const { data, error } = useQuery<GetArticleDailyLimitOutput, ApiAdapterError | Error>(
    queryKey,
    async () => {
      if (!feedId) {
        throw new Error("Missing feed selection");
      }

      return getArticleDailyLimit({
        feedId,
      });
    },
    {
      enabled: !!feedId,
      refetchOnWindowFocus: true,
    },
  );

  return {
    data: data?.result,
    error,
  };
};
