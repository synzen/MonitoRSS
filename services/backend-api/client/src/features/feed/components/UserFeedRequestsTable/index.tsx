import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Stack,
  Table, TableContainer, Tbody, Td, Th, Thead, Tr,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Loading } from '../../../../components';
import { useUserFeedRequestsWithPagination } from '../../hooks';
import { UserFeedRequestStatus } from '../../types';

interface Props {
  feedId?: string
}

const createStatusLabel = (status: UserFeedRequestStatus) => {
  switch (status) {
    case UserFeedRequestStatus.OK:
      return <Badge colorScheme="green">{status}</Badge>;
    case UserFeedRequestStatus.FETCH_ERROR:
    case UserFeedRequestStatus.FAILED:
    case UserFeedRequestStatus.PARSE_ERROR:
      return <Badge colorScheme="red">{status}</Badge>;
    default:
      return 'Unknown';
  }
};

export const UserFeedRequestsTable = ({ feedId }: Props) => {
  const {
    data,
    status,
    error,
    skip,
    limit,
    nextPage,
    prevPage,
    fetchStatus,
  } = useUserFeedRequestsWithPagination({
    feedId,
    data: {},
  });
  const { t } = useTranslation();

  if (status === 'loading') {
    return (
      <Flex width="100%" justifyContent="center">
        <Loading size="xl" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        {t('common.errors.somethingWentWrong')}
      </Alert>
    );
  }

  const total = data?.result.totalRequests || 0;

  const onFirstPage = skip === 0;
  const onLastPage = skip + limit >= total;

  return (
    <Stack spacing={4}>
      <Heading size="md">
        {t('features.userFeeds.components.requestsTable.title')}
      </Heading>
      <Stack>
        <Box
          border="solid 1px"
          borderColor="gray.600"
          borderRadius="md"
        >
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>
                    {t('features.userFeeds.components.requestsTable.tableHeaderDate')}
                  </Th>
                  <Th>
                    {t('features.userFeeds.components.requestsTable.tableHeaderStatus')}
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {data?.result.requests.map((req) => (
                  <Tr key={req.id}>
                    <Td>{dayjs.unix(req.createdAt).format('DD MMM YYYY, HH:mm:ss')}</Td>
                    <Td>{createStatusLabel(req.status)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
        <Flex justifyContent="space-between">
          {t('common.table.results', {
            start: skip + 1,
            end: skip + limit,
            total,
          })}
          <HStack>
            <Button
              width="min-content"
              onClick={prevPage}
              isDisabled={onFirstPage || fetchStatus === 'fetching'}
            >
              {t('features.feedConnections.components.filtersTabSection.prevPage')}
            </Button>
            <Button
              width="min-content"
              onClick={nextPage}
              isDisabled={onLastPage || fetchStatus === 'fetching'}
            >
              {t('features.feedConnections.components.filtersTabSection.nextPage')}
            </Button>
          </HStack>
        </Flex>
      </Stack>
    </Stack>
  );
};
