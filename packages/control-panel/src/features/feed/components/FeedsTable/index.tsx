/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react/jsx-props-no-spreading */
import {
  Alert,
  AlertIcon,
  Badge,
  ButtonGroup,
  Center,
  Flex,
  IconButton,
  Stack,
  Table, Td, Text, Th, Thead, Tr,
} from '@chakra-ui/react';
import { useEffect, useMemo } from 'react';
import { useTable, usePagination, Column } from 'react-table';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useFeeds } from '../../hooks';
import { Feed } from '../../types';
import { Loading } from '@/components';

interface Props {
  serverId?: string
  selectedFeedId?: string
  onSelectedFeedId?: (feedId: string) => void
}

const DEFAULT_MAX_PER_PAGE = 10;

const maxPerPage = DEFAULT_MAX_PER_PAGE;

const FeedStatusTag: React.FC<{ status: Feed['status'] }> = ({ status }) => (
  <Badge
    colorScheme={status === 'ok' ? 'green' : 'red'}
  >
    {status}
  </Badge>
);

export const FeedsTable: React.FC<Props> = ({
  serverId,
  selectedFeedId,
  onSelectedFeedId,
}) => {
  const { t } = useTranslation();
  const {
    data,
    status,
    error,
    setOffset,
    isFetchingNewContent,
  } = useFeeds({
    serverId,
    initialLimit: maxPerPage,
  });

  const tableData = useMemo(
    () => (data?.results || []).map((feed) => ({
      id: feed.id,
      status: feed.status,
      title: feed.title,
      url: feed.url,
      channel: feed.channel,
    })),
    [data],
  );

  const total = data?.total || 0;

  const columns = useMemo<Column<Pick<Feed, 'status' | 'title' | 'url' | 'channel'>>[]>(
    () => [
      {
        Header: t('pages.feeds.tableStatus') as string,
        accessor: 'status', // accessor is the "key" in the data
        Cell: ({
          cell: {
            value,
          },
        }) => <FeedStatusTag status={value} />,
      },
      {
        Header: t('pages.feeds.tableTitle') as string,
        accessor: 'title',
      },
      {
        Header: t('pages.feeds.tableUrl') as string,
        accessor: 'url',
      },
      {
        Header: t('pages.feeds.tableChannel') as string,
        accessor: 'channel',
      },
    ],
    [],
  );

  const tableInstance = useTable({
    columns,
    data: tableData,
    manualPagination: true,
    pageCount: Math.ceil(total / maxPerPage),
    initialState: {
      pageSize: maxPerPage,
    },
  }, usePagination);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    nextPage,
    canNextPage,
    previousPage,
    canPreviousPage,
    page,
    state: {
      pageIndex,
    },
  } = tableInstance;

  useEffect(() => {
    setOffset(pageIndex * maxPerPage);
  }, [pageIndex]);

  const onClickFeedRow = (feedId: string) => {
    onSelectedFeedId?.(feedId);
  };

  if (status === 'loading') {
    return (
      <Center width="100%" height="100%">
        <Loading size="lg" />
      </Center>
    );
  }

  if (status === 'error') {
    return (
      <Alert status="error">
        <AlertIcon />
        {error?.message}
      </Alert>
    );
  }

  return (
    <Stack>
      <Table
        {...getTableProps()}
        whiteSpace="nowrap"
        marginBottom="5"
        background="gray.850"
        borderColor="gray.700"
        borderWidth="2px"
        boxShadow="lg"
      >
        <Thead>
          {headerGroups.map((headerGroup) => (
            <Tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column) => (
                <Th {...column.getHeaderProps()}>
                  {column.render('Header')}
                </Th>
              ))}
            </Tr>
          ))}
        </Thead>
        <tbody {...getTableBodyProps()}>
          {page.map((row) => {
            prepareRow(row);

            return (
              <Tr
                {...row.getRowProps()}
                key={row.id}
                tabIndex={0}
                zIndex={100}
                position="relative"
                bg={selectedFeedId === row.id ? 'gray.700' : undefined}
                _hover={{
                  bg: 'gray.700',
                  cursor: 'pointer',
                  boxShadow: 'outline',
                }}
                _focus={{
                  boxShadow: 'outline',
                  outline: 'none',
                }}
                onClick={() => onClickFeedRow(row.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onClickFeedRow(row.id);
                  }
                }}
              >
                {row.cells.map((cell) => (
                  <Td {...cell.getCellProps()}>
                    {cell.render('Cell')}
                  </Td>
                ))}
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <Flex justifyContent="space-between">
        <Text>
          {t('pages.feeds.tableResults', {
            start: pageIndex * maxPerPage + 1,
            end: Math.min(
              (pageIndex + 1) * maxPerPage,
              total,
            ),
            total,
          })}

        </Text>
        <ButtonGroup>
          <IconButton
            icon={<ChevronLeftIcon />}
            aria-label="Previous page"
            onClick={previousPage}
            isDisabled={isFetchingNewContent || !canPreviousPage}
          />
          <Flex alignItems="center">
            <Text>{pageIndex + 1}</Text>
            /
            <Text>{Math.ceil(total / maxPerPage)}</Text>
          </Flex>
          <IconButton
            icon={<ChevronRightIcon />}
            aria-label="Next page"
            onClick={nextPage}
            disabled={isFetchingNewContent || !canNextPage}
          />
        </ButtonGroup>
      </Flex>
    </Stack>
  );
};
