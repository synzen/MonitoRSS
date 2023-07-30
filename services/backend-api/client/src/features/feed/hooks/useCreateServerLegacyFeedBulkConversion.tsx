import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createServerLegacyFeedBulkConversion,
  CreateServerLegacyFeedBulkConversionInput,
  CreateServerLegacyFeedBulkConversionOutput,
} from "../api";

export const useCreateServerLegacyFeedBulkConversion = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error } = useMutation<
    CreateServerLegacyFeedBulkConversionOutput,
    ApiAdapterError,
    CreateServerLegacyFeedBulkConversionInput
  >((details) => createServerLegacyFeedBulkConversion(details), {
    onSuccess: (_, inputData) => {
      return queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "server-legacy-feed-bulk-conversion" &&
          // @ts-ignore
          query.queryKey[1].serverId === inputData.serverId,
      });
    },
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
