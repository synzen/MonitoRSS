import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { getServerStatus, GetServerStatusOutput } from "../api";

interface Props {
  serverId?: string;
}

export const useDiscordServerAccessStatus = ({ serverId }: Props) => {
  const [hasErrored, setHasErrored] = useState(false);

  const { data, error, status, isFetching } = useQuery<GetServerStatusOutput, ApiAdapterError>(
    {
      queryKey: ["server-status", serverId],
      queryFn: async () => {
        if (!serverId) {
          throw new Error("Server ID is required when fetching discord server status");
        }

        return getServerStatus({
          serverId,
        });
      },
      enabled: !!serverId && !hasErrored,
    },
  );

  useEffect(() => {
    if (error) {
      setHasErrored(true);
    }
  }, [error]);

  return {
    data,
    error,
    status,
    isFetching,
  };
};
