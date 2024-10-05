import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { getServerChannels, GetServerChannelsOutput } from "../api";
import { useDiscordServerAccessStatus } from "./useDiscordServerAccessStatus";
import { GetDiscordChannelType } from "../constants";

interface Props {
  serverId?: string;
  include?: GetDiscordChannelType[];
}

export const useDiscordServerChannels = ({ serverId, include }: Props) => {
  const { data: accessData, isFetching: isFetchingAccessData } = useDiscordServerAccessStatus({
    serverId,
  });
  const [hadError, setHadError] = useState(false);
  const queryKey = [
    "server-channels",
    {
      serverId,
      include,
    },
  ];

  const { data, status, error, isFetching } = useQuery<GetServerChannelsOutput, ApiAdapterError>(
    queryKey,
    async () => {
      if (!serverId) {
        throw new Error("Missing server ID when getting server channels");
      }

      return getServerChannels({
        serverId,
        include,
      });
    },
    {
      enabled: !!accessData?.result.authorized && !hadError && !!serverId,
      onError: () => setHadError(true),
      /**
       * New channels may be created when window is out-of-focus
       */
      refetchOnWindowFocus: true,
    }
  );

  return {
    data,
    status,
    error,
    isFetching: isFetchingAccessData || isFetching,
  };
};
