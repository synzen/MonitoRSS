import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { GetDiscordWebhooksOutput, getDiscordWebhooks } from "../api";

interface Props {
  serverId?: string;
  isWebhooksEnabled?: boolean;
}

export const useDiscordWebhooks = ({ serverId, isWebhooksEnabled }: Props) => {
  const [hasErrored, setHasErrored] = useState(false);

  const enabled = !!serverId && isWebhooksEnabled && !hasErrored;

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
      onError: () => {
        setHasErrored(true);
      },
    }
  );

  return {
    data: data?.results,
    status,
    fetchStatus,
    error,
  };
};
