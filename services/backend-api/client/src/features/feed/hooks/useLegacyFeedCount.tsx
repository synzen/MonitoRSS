import { useQuery } from "@tanstack/react-query";
import { GetLegacyFeedCount, GetLegacyFeedCountOutput } from "../api";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { useDiscordServerAccessStatus } from "@/features/discordServers";

interface Props {
  serverId?: string;
}

export const useLegacyFeedCount = ({ serverId }: Props) => {
  const { data: accessData } = useDiscordServerAccessStatus({ serverId });

  const queryKey = [
    "legacy-feed-count",
    {
      serverId,
    },
  ];

  const { data, status, error } = useQuery<GetLegacyFeedCountOutput, ApiAdapterError>(
    queryKey,
    async () => {
      if (!serverId) {
        throw new Error("Missing server ID when getting legacy feed count");
      }

      const result = await GetLegacyFeedCount({
        serverId,
      });

      return result;
    },
    {
      enabled: !!accessData?.result.authorized,
    }
  );

  return {
    data,
    status,
    error,
  };
};
