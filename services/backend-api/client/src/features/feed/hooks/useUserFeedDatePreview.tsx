import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  createUserFeedDatePreview,
  CreateUserFeedDatePreviewInput,
  CreateUserFeedDatePreviewOutput,
} from "../api";

interface Props {
  feedId?: string;
  data: CreateUserFeedDatePreviewInput["data"];
  disabled?: boolean;
}

export const useUserFeedDatePreview = ({ feedId, data: inputData, disabled }: Props) => {
  const queryKey = [
    "user-feed-date-preview",
    {
      feedId,
      inputData,
    },
  ];

  const { data, status, error, refetch, fetchStatus } = useQuery<
    CreateUserFeedDatePreviewOutput,
    ApiAdapterError | Error
  >(
    queryKey,
    async () => {
      if (!feedId) {
        throw new Error("Missing feed selection for creating date preview");
      }

      return createUserFeedDatePreview({
        feedId,
        data: inputData,
      });
    },
    {
      enabled: !!feedId || disabled,
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
