import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GetServerLegacyFeedBulkConversionInput,
  GetServerLegacyFeedBulkConversionOutput,
  getServerLegacyFeedBulkConversion,
} from "../api";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { useDiscordServerAccessStatus } from "@/features/discordServers";

export const useSeverLegacyFeedBulkConversion = (
  input: Partial<GetServerLegacyFeedBulkConversionInput>,
  options?: {
    disablePolling?: boolean;
  }
) => {
  const queryClient = useQueryClient();

  const { data: accessData } = useDiscordServerAccessStatus({ serverId: input.serverId });

  const queryKey = ["server-legacy-feed-bulk-conversion", input];

  const { data, status, error } = useQuery<
    GetServerLegacyFeedBulkConversionOutput,
    ApiAdapterError
  >(
    queryKey,
    async () => {
      if (!input.serverId) {
        throw new Error("Missing server ID when getting legacy feed count");
      }

      return getServerLegacyFeedBulkConversion({
        serverId: input.serverId,
      });
    },
    {
      enabled: !!accessData?.result.authorized,
      refetchInterval: (result) => {
        if (options?.disablePolling) {
          return false;
        }

        if (result?.status === "IN_PROGRESS") {
          return 5000;
        }

        return false;
      },
      onSuccess: async (result) => {
        if (result.status === "COMPLETED") {
          await queryClient.invalidateQueries({
            predicate: (query) => {
              return (
                query.queryKey[0] === "feed" ||
                query.queryKey[0] === "feeds" ||
                query.queryKey[0] === "user-feeds" ||
                query.queryKey[0] === "discord-user-me" ||
                query.queryKey[0] === "legacy-feed-count"
              );
            },
          });
        }
      },
    }
  );

  return {
    data,
    status,
    error,
  };
};
