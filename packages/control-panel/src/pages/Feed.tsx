import { CheckCircleIcon } from '@chakra-ui/icons';
import {
  Flex, Grid, Heading, Stack, Text,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import CategoryText from '../components/CategoryText';
import DashboardContent from '../components/DashboardContent';
import Navbar from '../components/Navbar';
import useFeed from '../hooks/useFeed';
import NavbarBreadcrumbItem from '../types/NavbarBreadcrumbItem';
import RouteParams from '../types/RouteParams';

const Feed: React.FC = () => {
  const { feedId } = useParams<RouteParams>();

  const { feed, status, error } = useFeed({
    feedId,
  });

  const breadcrumbItems: Array<NavbarBreadcrumbItem> = [{
    id: 'feeds',
    content: 'Feeds',
    enabled: true,
  }, {
    id: 'feed',
    content: feedId,
    enabled: !!feedId,
  }];

  return (
    <Stack>
      <Navbar
        breadcrumbItems={breadcrumbItems}
      />
      <DashboardContent
        error={error}
        loading={status === 'loading' || status === 'idle'}
      >
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
    </Stack>
  );
};

export default Feed;
