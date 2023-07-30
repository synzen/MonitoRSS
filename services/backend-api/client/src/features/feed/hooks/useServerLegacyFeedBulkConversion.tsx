import { useQuery } from "@tanstack/react-query";
import {
  GetServerLegacyFeedBulkConversionInput,
  GetServerLegacyFeedBulkConversionOutput,
  getServerLegacyFeedBulkConversion,
} from "../api";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { useDiscordServerAccessStatus } from "@/features/discordServers";

export const useSeverLegacyFeedBulkConversion = (input: GetServerLegacyFeedBulkConversionInput) => {
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

      return getServerLegacyFeedBulkConversion(input);
    },
    {
      enabled: !!accessData?.result.authorized,
      refetchInterval(result) {
        if (result?.status === "COMPLETED") {
          return false;
        }

        return 5000;
      },
    }
  );

  return {
    data,
    status,
    error,
  };
};
