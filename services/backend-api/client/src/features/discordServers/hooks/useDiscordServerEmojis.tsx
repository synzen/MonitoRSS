import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { getServerEmojis, GetServerEmojisOutput } from "../api";
import { discordServerQueryKeys } from "../constants";

interface Props {
  serverId?: string;
  disabled?: boolean;
}

export const useDiscordServerEmojis = ({ serverId, disabled }: Props) => {
  const { data, status, error, isFetching, refetch } = useQuery<
    GetServerEmojisOutput,
    ApiAdapterError
  >({
    queryKey: discordServerQueryKeys.serverEmojis(serverId || ""),
    queryFn: async () => {
      if (!serverId) {
        throw new Error("Missing server ID when getting server emojis");
      }

      return getServerEmojis({
        serverId,
      });
    },
    enabled: !!serverId && !disabled,
  });

  return {
    data,
    status,
    error,
    isFetching,
    refetch,
  };
};
