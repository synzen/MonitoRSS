import { CheckCircleIcon } from '@chakra-ui/icons';
import {
  Flex, Grid, Heading, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import CategoryText from '../components/CategoryText';
import DashboardContent from '../components/DashboardContent';
import Navbar from '../components/Navbar';
import NavbarBreadcrumbItem from '../types/NavbarBreadcrumbItem';
import RouteParams from '../types/RouteParams';
import FeedMiscOptions from './FeedMiscOptions';

const Feed: React.FC = () => {
  const { feedId } = useParams<RouteParams>();

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
      <DashboardContent>
        <Stack spacing={12}>
          <Stack>
            <Flex alignItems="center">
              <Heading
                size="lg"
                marginRight={4}
              >
                New York Times

              </Heading>
              <CheckCircleIcon fontSize="2xl" color="green.500" verticalAlign="middle" />
            </Flex>
            <Text>
              https://www.nytimes.com/
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
            <CategoryText title="Channel">#new-york-tikmes</CategoryText>
            <CategoryText title="Refresh Rate">10 minutes</CategoryText>
            <CategoryText title="Since">12 August 2021</CategoryText>
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
