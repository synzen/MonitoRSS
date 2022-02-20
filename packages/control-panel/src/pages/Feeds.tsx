import { SearchIcon } from '@chakra-ui/icons';
import {
  Box,
  Button,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useQuery } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';
import getFeeds from '../adapters/feeds/getFeeds';
import DashboardContent from '../components/DashboardContent';
import Loading from '../components/Loading';
import Navbar from '../components/Navbar';
import { Feed } from '../types/Feed';
import NavbarBreadcrumbItem from '../types/NavbarBreadcrumbItem';
import RouteParams from '../types/RouteParams';

const Feeds: React.FC = () => {
  const { serverId } = useParams<RouteParams>();
  const { data, status } = useQuery(['feeds', serverId], async () => {
    if (!serverId) {
      throw new Error('No server ID selected');
    }

    return getFeeds({
      serverId,
    });
  }, {
    enabled: !!serverId,
  });

  const navigate = useNavigate();

  const breadcrumbItems: Array<NavbarBreadcrumbItem> = [{
    id: 'feeds',
    content: 'Feeds',
    enabled: true,
  }];

  const onClickFeedRow = (row: Feed) => {
    navigate(row.id);
  };

  return (
    <Stack>
      <Navbar
        breadcrumbItems={breadcrumbItems}
      />
      <DashboardContent>
        <Stack spacing="6">
          {/* <Heading as="h2" size="md">Current Feeds</Heading> */}
          <Stack spacing="4">
            <Flex justifyContent="space-between">

              <InputGroup>
                <InputLeftElement
                  pointerEvents="none"
                >
                  <SearchIcon color="gray.400" />
                </InputLeftElement>
                <Input width="sm" placeholder="Search feeds by id, name, or url" />
              </InputGroup>
              <Button colorScheme="blue">Add New</Button>
            </Flex>
            {status === 'loading' && (
              <Box textAlign="center" paddingY="5rem">
                <Loading size="lg" />
              </Box>
            )}
            {status === 'success' && data && (
            <Box overflow="auto">
              <Table size="lg" variant="simple" width="100%">
                <Thead>
                  <Tr>
                    <Th>Status</Th>
                    <Th>Title</Th>
                    <Th>Url</Th>
                    <Th>Channel</Th>
                    {/* <Th isNumeric>Refresh Rate</Th> */}
                    {/* <Th>Actions</Th> */}
                  </Tr>
                </Thead>
                <Tbody>
                  {data.results.map((row, index) => (
                    <Tr
                      onClick={() => onClickFeedRow(row)}
                      _focus={{
                        backgroundColor: 'gray.700',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                      _hover={{
                        backgroundColor: 'gray.700',
                        cursor: 'pointer',
                      }}
                      tabIndex={0}
                        // eslint-disable-next-line react/no-array-index-key
                      key={index}
                    >
                      <Td>{row.status}</Td>
                      <Td>{row.title}</Td>
                      <Td>{row.url}</Td>
                      <Td>{row.channel}</Td>
                      {/* <Td isNumeric>{row.refreshRate}</Td> */}
                      {/* <Td>
                          <Menu>
                            <MenuButton size="sm" as={Button} rightIcon={<ChevronDownIcon />}>
                              Actions
                            </MenuButton>
                            <MenuList>
                              <MenuItem>Download</MenuItem>
                              <MenuItem>Create a Copy</MenuItem>
                              <MenuItem>Mark as Draft</MenuItem>
                              <MenuItem>Delete</MenuItem>
                              <MenuItem>Attend a Workshop</MenuItem>
                            </MenuList>
                          </Menu>
                        </Td> */}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
            )}
          </Stack>
        </Stack>
      </DashboardContent>
    </Stack>
  );
};

export default Feeds;
