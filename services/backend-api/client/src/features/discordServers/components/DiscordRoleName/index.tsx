/* eslint-disable react/jsx-no-useless-fragment */
import { useMemo } from 'react';
import { Text, Tooltip } from '@chakra-ui/react';
import { Loading } from '@/components';
import { useDiscordServerRoles } from '../../hooks';

interface Props {
  serverId?: string
  roleId: string
}

export const DiscordRoleName: React.FC<Props> = ({
  serverId,
  roleId,
}) => {
  const { data, status, error } = useDiscordServerRoles({ serverId });
  const roleNamesById = useMemo(() => {
    const map = new Map<string, string>();

    if (data?.results) {
      data.results.forEach((role) => {
        map.set(role.id, role.name);
      });
    }

    return map;
  }, [data]);

  if (status === 'loading') {
    return <Loading size="sm" />;
  }

  if (error) {
    return (
      <Tooltip
        placement="bottom-start"
        label={`Unable to get role name (${error?.message})`}
      >
        <Text color="orange.500">
          {roleId}
        </Text>
      </Tooltip>
    );
  }

  const channelName = roleNamesById.get(roleId) || roleId;

  return <>{`#${channelName}`}</>;
};
