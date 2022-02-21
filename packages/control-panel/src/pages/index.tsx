import { Box, Flex, Stack } from '@chakra-ui/react';
import {
  Navigate,
  Route, Routes, useLocation, useNavigate, useParams,
} from 'react-router-dom';
import { Loading, ThemedSelect } from '@/components';
import { SidebarDiscordServerLinks, useDiscordServers } from '../features/discordServers';
import { SidebarFeedLinks } from '../features/feed';
import Feed from './Feed';
import FeedFilters from './FeedFilters';
import FeedMessage from './FeedMessage';
import FeedMiscOptions from './FeedMiscOptions';
import Feeds from './Feeds';
import FeedSubscribers from './FeedSubscribers';
import Home from './Home';
import ServerDasboard from './ServerDashboard';
import Servers from './Servers';
import { RequireAuth } from '@/features/auth';

const Pages: React.FC = () => (
  <Routes>
    <Route
      path="/"
      element={<Home />}
    />
    <Route
      path="/servers"
      element={(
        <RequireAuth>
          <Servers />
        </RequireAuth>
    )}
    />
    <Route
      path="/servers/:serverId"
      element={(
        <RequireAuth>
          <DashboardContent>
            <ServerDasboard />
          </DashboardContent>
        </RequireAuth>
)}
    />
    <Route
      path="/servers/:serverId/server-settings"
      element={(
        <RequireAuth>
          <DashboardContent>
            <ServerDasboard />
          </DashboardContent>
        </RequireAuth>
)}
    />
    <Route
      path="/servers/:serverId/feeds"
      element={(
        <RequireAuth>
          <DashboardContent>
            <Feeds />
          </DashboardContent>
        </RequireAuth>
)}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId"
      element={(
        <RequireAuth>
          <DashboardContent requireFeed>
            <Feed />
          </DashboardContent>
        </RequireAuth>
)}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/message"
      element={(
        <RequireAuth>
          <DashboardContent requireFeed>
            <FeedMessage />
          </DashboardContent>
        </RequireAuth>
)}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/filters"
      element={(
        <RequireAuth>
          <DashboardContent requireFeed>
            <FeedFilters />
          </DashboardContent>
        </RequireAuth>
)}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/subscribers"
      element={(
        <RequireAuth>
          <DashboardContent requireFeed>
            <FeedSubscribers />
          </DashboardContent>
        </RequireAuth>
)}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/misc-options"
      element={(
        <RequireAuth>
          <DashboardContent requireFeed>
            <FeedMiscOptions />
          </DashboardContent>
        </RequireAuth>
)}
    />
  </Routes>
);

const DashboardContent: React.FC<{ requireFeed?: boolean }> = ({ requireFeed, children }) => {
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
        <Loading size="lg" />
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
            {/* <Flex px="3" py="4" minH="12" align="center">
          <Text fontWeight="bold" fontSize="sm" lineHeight="1.25rem">
            Monito.RSS
          </Text>
        </Flex> */}
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

export default Pages;
