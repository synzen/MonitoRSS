import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { GetServerMembersOutput, getServerMembers } from "../api";
import { useDiscordServerAccessStatus } from "./useDiscordServerAccessStatus";

interface Props {
  serverId?: string;
  data: {
    limit: number;
    search: string;
  };
  disabled?: boolean;
}

export const useDiscordServerMembers = ({ serverId, data: inputData, disabled }: Props) => {
  const { data: accessData, isFetching: isFetchingAccessData } = useDiscordServerAccessStatus({
    serverId,
  });
  const queryKey = [
    "server-channels",
    {
      serverId,
      inputData,
    },
  ];

  const { data, status, error, isFetching } = useQuery<GetServerMembersOutput, ApiAdapterError>(
    queryKey,
    async () => {
      if (!serverId) {
        throw new Error("Missing server ID when getting server members");
      }

      return getServerMembers({
        serverId,
        data: inputData,
      });
    },
    {
      enabled: !!accessData?.result.authorized && !!serverId && !disabled,
    },
  );

  return {
    data,
    status,
    error,
    isFetching: isFetchingAccessData || isFetching,
  };
};
