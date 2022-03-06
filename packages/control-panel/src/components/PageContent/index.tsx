import {
  Avatar,
  Box, Divider, Flex, Stack,
} from '@chakra-ui/react';
import {
  Navigate, useLocation, useNavigate, useParams,
} from 'react-router-dom';
import { SidebarDiscordServerLinks, useDiscordServers } from '@/features/discordServers';
import { Loading } from '..';
import { SidebarFeedLinks } from '@/features/feed';
import { useDiscordUserMe, UserStatusTag } from '@/features/discordUser';
import { DiscordUserDropdown } from '@/features/discordUser/components/DiscordUserDropdown';

interface Props {
  requireFeed?: boolean;
}

export const PageContent: React.FC<Props> = ({ requireFeed, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { feedId, serverId } = useParams();
  const {
    status,
    error,
  } = useDiscordServers();
  const {
    data: userMe,
  } = useDiscordUserMe();

  const onPathChanged = (path: string) => {
    navigate(path, {
      replace: true,
    });
  };

  if (status === 'loading') {
    return (
      <Box
        width="100vw"
        height="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Loading />
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <div>
        Error while getting servers
        {' '}
        {error?.message}
      </div>
    );
  }

  if (!serverId) {
    return <Navigate to="/servers" />;
  }

  if (!feedId && requireFeed) {
    return <Navigate to={`/servers/${serverId}/feeds`} />;
  }

  return (
    <Flex flexGrow={1} height="100vh">
      <Flex
        overflow="auto"
        as="nav"
        height="100%"
        direction="column"
        maxW="18rem"
        width="full"
        paddingBottom="4"
        borderRightWidth="1px"
      >
        <Stack
          paddingX="8"
          marginTop="8"
          display="flex"
          justifyContent="center"
          alignItems="center"
          spacing="4"
        >
          <Stack
            width="100%"
            justifyContent="center"
            alignItems="center"
            spacing="4"
          >
            <Avatar
              name={userMe?.username}
              src={userMe?.iconUrl}
              size="xl"
            />
            <DiscordUserDropdown />
          </Stack>
          <UserStatusTag />
        </Stack>
        <Divider marginY="8" />
        <Stack spacing="12">
          <Stack px="3" spacing="6">
            <Stack spacing="3">
              {!feedId && (
                <SidebarDiscordServerLinks
                  currentPath={location.pathname}
                  onChangePath={onPathChanged}
                  serverId={serverId}
                />
              )}
              {feedId && (
                <SidebarFeedLinks
                  currentPath={location.pathname}
                  feedId={feedId}
                  serverId={serverId}
                  onChangePath={onPathChanged}
                />
              )}
            </Stack>
          </Stack>
        </Stack>
      </Flex>
      <Flex
        width="100%"
        justifyContent="center"
        overflow="auto"
      >
        <Box width="100%">
          {children}
        </Box>
      </Flex>
    </Flex>
  );
};
