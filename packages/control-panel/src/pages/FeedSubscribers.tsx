import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import DashboardContent from '../components/DashboardContent';
import Navbar from '../components/Navbar';
import NavbarBreadcrumbItem from '../types/NavbarBreadcrumbItem';
import RouteParams from '../types/RouteParams';

const sampleSubscribers = [{
  key: '1',
  name: '@green',
}, {
  key: '2',
  name: '@red',
}, {
  key: '3',
  name: '@admin',
}, {
  key: '4',
  name: '@news',
}];

const FeedSubscribers: React.FC = () => {
  const { feedId } = useParams<RouteParams>();

  const breadcrumbItems: Array<NavbarBreadcrumbItem> = [{
    id: 'feeds',
    content: 'Feeds',
    enabled: true,
  }, {
    id: 'feed',
    content: feedId,
    enabled: true,
  }, {
    id: 'miscoptions',
    content: 'Misc Options',
    enabled: true,
  }];

  return (
    <Stack>
      <Navbar breadcrumbItems={breadcrumbItems} />
      <DashboardContent>
        <Stack spacing="12">
          <Stack spacing="4">
            <Heading size="lg">Add Subscriber</Heading>
            <HStack>
              <FormControl width={250}>
                <FormLabel htmlFor="subscriber-name">Subscribers</FormLabel>
                <Select id="subscriber-name">
                  <option>Title</option>
                  <option>Description</option>
                </Select>
              </FormControl>
              <Button alignSelf="flex-end" minWidth="100" colorScheme="blue">
                Add
              </Button>
            </HStack>
          </Stack>
          <Stack spacing="4">
            <Heading size="md">Existing Subscribers</Heading>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Subscriber</Th>
                  <Th>Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {sampleSubscribers.map((subscriber) => (
                  <Tr key={subscriber.key}>
                    <Td>{subscriber.name}</Td>
                    <Td>
                      <HStack>
                        <IconButton
                          icon={(
                            <EditIcon />
                      )}
                          aria-label={`Edit subscriber ${subscriber.name} filters`}
                          background="none"
                        />
                        <IconButton
                          icon={(
                            <DeleteIcon />
                      )}
                          aria-label={`Delete subscriber ${subscriber.name}`}
                          background="none"
                        />
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Stack>
        </Stack>
      </DashboardContent>
    </Stack>
  );
};

export default FeedSubscribers;
