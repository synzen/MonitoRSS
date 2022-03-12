import { useQuery } from 'react-query';
import ApiAdapterError from '../../../utils/ApiAdapterError';
import { getServerRoles, GetServerRolesOutput } from '../api';

interface Props {
  serverId?: string
}

export const useDiscordServerRoles = (
  { serverId }: Props,
) => {
  const { data, status, error } = useQuery<GetServerRolesOutput, ApiAdapterError>(
    ['server-roles', {
      serverId,
    }],
    async () => {
      if (!serverId) {
        throw new Error('Missing server ID when getting server roles');
      }

      return getServerRoles({
        serverId,
      });
    },
    {
      enabled: !!serverId,
    },
  );

  return {
    data,
    status,
    error,
  };
};
