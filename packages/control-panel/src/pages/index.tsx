import { Box, Flex, Stack } from '@chakra-ui/react';
import { useQuery } from 'react-query';
import {
  Navigate,
  Route, Routes, useLocation, useNavigate, useParams,
} from 'react-router-dom';
import ApiAdapterError from '../adapters/ApiAdapterError';
import getServers, { GetServersOutput } from '../adapters/servers/getServer';
import Loading from '../components/Loading';
import ManageFeedLinks from '../components/Sidebar/ManageFeedLinks';
import ManageServerLinks from '../components/Sidebar/ManageServerLinks';
import ThemedSelect from '../components/ThemedSelect';
import Feed from './Feed';
import FeedFilters from './FeedFilters';
import FeedMessage from './FeedMessage';
import FeedMiscOptions from './FeedMiscOptions';
import Feeds from './Feeds';
import FeedSubscribers from './FeedSubscribers';
import Home from './Home';
import ServerDasboard from './ServerDashboard';
import Servers from './Servers';

const Pages: React.FC = () => (
  <Routes>
    <Route
      path="/"
      element={<Home />}
    />
    <Route
      path="/servers"
      element={<Servers />}
    />
    <Route
      path="/servers/:serverId"
      element={<DashboardContent content={<ServerDasboard />} />}
    />
    <Route
      path="/servers/:serverId/server-settings"
      element={<DashboardContent content={<ServerDasboard />} />}
    />
    <Route
      path="/servers/:serverId/feeds"
      element={<DashboardContent content={<Feeds />} />}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId"
      element={<DashboardContent content={<Feed />} />}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/message"
      element={<DashboardContent content={<FeedMessage />} />}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/filters"
      element={<DashboardContent content={<FeedFilters />} />}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/subscribers"
      element={<DashboardContent content={<FeedSubscribers />} />}
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/misc-options"
      element={<DashboardContent content={<FeedMiscOptions />} />}
    />
  </Routes>
);

const DashboardContent: React.FC<{ content: React.ReactNode }> = ({ content }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { feedId, serverId } = useParams();
  const {
    status,
    data,
    error,
  } = useQuery<GetServersOutput, ApiAdapterError>('servers', async () => getServers());

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
                <ManageServerLinks
                  currentPath={location.pathname}
                  onChangePath={onPathChanged}
                  serverId={serverId}
                />
              )}
              {feedId && (
                <ManageFeedLinks
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
          {content}
        </Box>
      </Flex>
    </Flex>
  );
};

export default Pages;
