import { CheckCircleIcon } from '@chakra-ui/icons';
import {
  Alert,
  AlertIcon,
  Box,
  Flex, Grid, Heading, Stack, Text,
} from '@chakra-ui/react';
import { useQuery } from 'react-query';
import { Navigate, useParams } from 'react-router-dom';
import ApiAdapterError from '../adapters/ApiAdapterError';
import getFeed, { GetFeedOutput } from '../adapters/feeds/getFeed';
import CategoryText from '../components/CategoryText';
import DashboardContent from '../components/DashboardContent';
import Loading from '../components/Loading';
import Navbar from '../components/Navbar';
import NavbarBreadcrumbItem from '../types/NavbarBreadcrumbItem';
import RouteParams from '../types/RouteParams';

const Feed: React.FC = () => {
  const { serverId, feedId } = useParams<RouteParams>();

  if (!serverId) {
    return <Navigate to="/servers" />;
  }

  if (!feedId) {
    return <Navigate to={`/servers/${serverId}/feeds`} />;
  }

  const { data, status, error } = useQuery<GetFeedOutput, ApiAdapterError | Error>(
    ['feed', serverId, feedId],
    async () => getFeed({
      serverId,
      feedId,
    }),
  );

  const breadcrumbItems: Array<NavbarBreadcrumbItem> = [{
    id: 'feeds',
    content: 'Feeds',
    enabled: true,
  }, {
    id: 'feed',
    content: feedId,
    enabled: !!feedId,
  }];

  const feed = data?.result;

  return (
    <Stack>
      <Navbar
        breadcrumbItems={breadcrumbItems}
      />
      {status === 'loading' && (
      <Box textAlign="center" paddingY="5rem">
        <Loading />
      </Box>
      )}
      {status === 'error' && (
      <Alert status="error">
        <AlertIcon />
        {error?.message}
      </Alert>
      )}
      {status === 'success' && data && (
      <DashboardContent>
        <Stack spacing={12}>
          <Stack>
            <Flex alignItems="center">
              <Heading
                size="lg"
                marginRight={4}
              >
                {feed?.title}

              </Heading>
              <CheckCircleIcon fontSize="2xl" color="green.500" verticalAlign="middle" />
            </Flex>
            <Text>
              {feed?.url}
            </Text>
          </Stack>
          <Grid
            templateColumns={{
              base: '1fr',
              sm: 'repeat(2, 1fr)',
              lg: 'repeat(4, fit-content(320px))',
            }}
            columnGap="20"
            rowGap={{ base: '8', lg: '14' }}
          >
            <CategoryText title="Channel">{feed?.channel}</CategoryText>
            <CategoryText title="Refresh Rate">
              {feed?.refreshRateSeconds}
              {' '}
              seconds
            </CategoryText>
            <CategoryText title="Since">{feed?.createdAt}</CategoryText>
          </Grid>
        </Stack>
        {/* <Stack width="min">
          <Button as={Link} to="message">Edit Message</Button>
          <Button as={Link} to="filters">Edit Filters</Button>
          <Button as={Link} to="misc-options">Edit Misc Options</Button>
        </Stack> */}
      </DashboardContent>
      )}
    </Stack>
  );
};

export default Feed;
