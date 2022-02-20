import { DeleteIcon } from '@chakra-ui/icons';
import {
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
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
import { DashboardContent, Navbar } from '@/components';
import NavbarBreadcrumbItem from '../types/NavbarBreadcrumbItem';
import RouteParams from '../types/RouteParams';

const sampleFilters = [{
  key: '1',
  category: 'title',
  value: 'My Feed',
}, {
  key: '2',
  category: 'description',
  value: 'This is a description',
}, {
  key: '3',
  category: 'url',
  value: 'https://www.example.com',
}, {
  key: '4',
  category: 'title',
  value: 'My Feed 2',
}];

const FeedFilters: React.FC = () => {
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
    id: 'filters',
    content: 'Filters',
    enabled: true,
  }];

  return (
    <Stack>
      <Navbar breadcrumbItems={breadcrumbItems} />
      <DashboardContent>
        <Stack spacing="12">
          <Stack spacing="4">
            <Heading size="lg">Add Filter</Heading>
            <HStack>
              <FormControl width={250}>
                <FormLabel htmlFor="filter-category">Category</FormLabel>
                <Select id="filter-category">
                  <option>Title</option>
                  <option>Description</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel htmlFor="filter-value">Value</FormLabel>
                <Input />
              </FormControl>
              <Button alignSelf="flex-end" minWidth="100" colorScheme="blue">
                Add
              </Button>
            </HStack>
          </Stack>
          <Stack spacing="4">
            <Heading size="md">Existing Filters</Heading>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Category</Th>
                  <Th>Value</Th>
                  <Th>Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {sampleFilters.map((filter) => (
                  <Tr key={filter.key}>
                    <Td>{filter.category}</Td>
                    <Td>{filter.value}</Td>
                    <Td>
                      <IconButton
                        icon={(
                          <DeleteIcon />
                      )}
                        aria-label={`Delete filter ${filter.value}`}
                        background="none"
                      />
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

export default FeedFilters;
