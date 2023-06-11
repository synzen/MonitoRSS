import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { GetDiscordWebhooksOutput, getDiscordWebhooks } from "../api";

interface Props {
  serverId?: string;
  isWebhooksEnabled?: boolean;
}

export const useDiscordWebhooks = ({ serverId, isWebhooksEnabled }: Props) => {
  const enabled = !!serverId && isWebhooksEnabled;

  const { data, status, error, fetchStatus } = useQuery<GetDiscordWebhooksOutput, ApiAdapterError>(
    [
      "discord-server-webhooks",
      {
        serverId,
      },
    ],
    async () => {
      if (!serverId) {
        throw new Error("Missing server selection when getting server webhooks");
      }

      return getDiscordWebhooks({
        serverId,
      });
    },
    {
      enabled,
    }
  );

  return {
    data: data?.results,
    status,
    fetchStatus,
    error,
  };
};
