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
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardContent, Loading } from '@/components';
import { FeedStatusIcon, FeedSummary, useFeeds } from '../features/feed';
import RouteParams from '../types/RouteParams';

const Feeds: React.FC = () => {
  const { serverId } = useParams<RouteParams>();
  const { t } = useTranslation();

  if (!serverId) {
    return <Navigate to="/servers" />;
  }

  const { data, status, error } = useFeeds({
    serverId,
  });

  const navigate = useNavigate();

  const onClickFeedRow = (feed: FeedSummary) => {
    navigate(feed.id);
  };

  return (
    <Stack>
      <DashboardContent>
        {(status === 'loading') && (
        <Box textAlign="center" paddingY="5rem">
          <Loading size="lg" />
        </Box>
        )}
        {status === 'error' && (
        <Alert status="error">
          <AlertIcon />
          {error?.message}
        </Alert>
        )}
        {status === 'success' && data && (
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
                <Input width="sm" placeholder={t('pages.feeds.search')} />
              </InputGroup>
              <Button colorScheme="blue">{t('pages.feeds.add')}</Button>
            </Flex>
            <Box overflow="auto">
              <Table size="lg" variant="simple" width="100%">
                <Thead>
                  <Tr>
                    <Th>{t('pages.feeds.status')}</Th>
                    <Th>{t('pages.feeds.title')}</Th>
                    <Th>{t('pages.feeds.url')}</Th>
                    <Th>{t('pages.feeds.channel')}</Th>
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
                      <Td>
                        <FeedStatusIcon status={row.status} />
                      </Td>
                      <Td>{row.title}</Td>
                      <Td>{row.url}</Td>
                      <Td>{row.channel}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Stack>
        </Stack>
        )}
      </DashboardContent>
    </Stack>
  );
};

export default Feeds;
