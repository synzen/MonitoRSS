import {
  Avatar,
  Box, Divider, Flex, Heading, Stack, Text,
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
        maxW="325px"
        width="full"
        paddingBottom="4"
        borderRightWidth="1px"
      >
        <Flex
          justifyContent="center"
          flexDir="column"
          height="75px"
          width="full"
          background="gray.700"
          padding="4"
        >
          <Heading fontSize="3xl">Monito.RSS</Heading>
          <Text display="block">Control Panel</Text>
        </Flex>
        <Stack
          paddingX="6"
          marginTop="8"
          display="flex"
          alignItems="flex-start"
          spacing="4"
        >
          <Stack
            width="100%"
            alignItems="flex-start"
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
        <Stack px="6" spacing="9">
          <SidebarDiscordServerLinks
            currentPath={location.pathname}
            onChangePath={onPathChanged}
            serverId={serverId}
          />
          <SidebarFeedLinks
            currentPath={location.pathname}
            feedId={feedId}
            serverId={serverId}
            onChangePath={onPathChanged}
          />
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
