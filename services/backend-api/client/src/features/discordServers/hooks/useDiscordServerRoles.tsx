import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { getServerRoles, GetServerRolesOutput } from "../api";
import { discordServerQueryKeys } from "../constants";

interface Props {
  serverId?: string;
  disabled?: boolean;
}

export const useDiscordServerRoles = ({ serverId, disabled }: Props) => {
  const { data, status, error, isFetching } = useQuery<GetServerRolesOutput, ApiAdapterError>(
    discordServerQueryKeys.serverRoles(serverId || ""),
    async () => {
      if (!serverId) {
        throw new Error("Missing server ID when getting server roles");
      }

      return getServerRoles({
        serverId,
      });
    },
    {
      enabled: !!serverId && !disabled,
    }
  );

  const getRolebyId = (roleId: string) => {
    if (!data?.results) {
      return null;
    }

    return data.results.find((role) => role.id === roleId) || null;
  };

  return {
    data,
    status,
    error,
    getRolebyId,
    isFetching,
  };
};
