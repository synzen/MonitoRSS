import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  getServerActiveThreads,
  GetServerActiveThreadsInput,
  GetServerActiveThreadsOutput,
} from "../api";
import { useDiscordServerAccessStatus } from "./useDiscordServerAccessStatus";

interface Props extends Partial<GetServerActiveThreadsInput> {}

export const useDiscordServerActiveThreads = ({ serverId, options }: Props) => {
  const { data: accessData, isFetching: isFetchingAccessData } = useDiscordServerAccessStatus({
    serverId,
  });
  const queryKey = [
    "server-active-threads",
    {
      serverId,
      options,
    },
  ];

  const { data, status, error, isFetching } = useQuery<
    GetServerActiveThreadsOutput,
    ApiAdapterError
  >(
    queryKey,
    async () => {
      if (!serverId) {
        throw new Error("Missing server ID when getting server channels");
      }

      return getServerActiveThreads({
        serverId,
        options,
      });
    },
    {
      enabled: !!accessData?.result.authorized && !!serverId,
    },
  );

  return {
    data,
    status,
    error,
    isFetching: isFetchingAccessData || isFetching,
  };
};
