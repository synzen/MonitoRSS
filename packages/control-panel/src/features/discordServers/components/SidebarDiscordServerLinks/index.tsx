import { Stack, Text } from '@chakra-ui/react';
import { FiRss, FiSettings } from 'react-icons/fi';
import { SidebarLink } from '../../../../components/SidebarLink';

interface Props {
  currentPath: string
  serverId: string
  onChangePath: (path: string) => void
}

export const SidebarDiscordServerLinks: React.FC<Props> = ({
  currentPath, serverId, onChangePath,
}) => {
  const onClickNavLink = (path: string) => {
    onChangePath(path);
  };

  const paths = {
    SERVER_FEEDS: `/servers/${serverId}/feeds`,
    SERVER_SETTINGS: `/servers/${serverId}/server-settings`,
  };

  return (
    <Stack spacing="2">
      <Text
        px="3"
        fontSize="xs"
        fontWeight="semibold"
        textTransform="uppercase"
        letterSpacing="widest"
        color="gray.500"
        mb="3"
      >
        Manage Server
      </Text>
      <SidebarLink
        icon={FiRss}
        active={currentPath.startsWith(paths.SERVER_FEEDS)}
        onClick={() => onClickNavLink(paths.SERVER_FEEDS)}
      >
        Feeds
      </SidebarLink>
      <SidebarLink
        icon={FiSettings}
        active={currentPath === paths.SERVER_SETTINGS}
        onClick={() => {
          onClickNavLink(paths.SERVER_SETTINGS);
        }}
      >
        Settings
      </SidebarLink>
    </Stack>

  );
};
