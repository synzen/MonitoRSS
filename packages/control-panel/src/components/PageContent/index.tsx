import {
  Box, Flex, Stack,
} from '@chakra-ui/react';
import {
  Navigate, useLocation, useNavigate, useParams,
} from 'react-router-dom';
import { SidebarDiscordServerLinks, useDiscordServers } from '@/features/discordServers';
import { Loading, ThemedSelect } from '..';
import { SidebarFeedLinks } from '@/features/feed';

interface Props {
  requireFeed?: boolean;
}

export const PageContent: React.FC<Props> = ({ requireFeed, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { feedId, serverId } = useParams();
  const {
    status,
    data,
    error,
  } = useDiscordServers();

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
        as="nav"
        height="100%"
        direction="column"
        justify="space-between"
        maxW="18rem"
        width="full"
        paddingY="4"
        borderRightWidth="1px"
      >
        <Stack spacing="12">
          <Stack px="3">
            <ThemedSelect
              selectedValue={serverId}
              options={data?.results.map((server) => ({
                label: server.name,
                value: server.id,
              })) || []}
              onChangedValue={(value) => onPathChanged(`/servers/${value}/feeds`)}
            />
          </Stack>
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
