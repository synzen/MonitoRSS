/* eslint-disable react/no-unstable-nested-components */
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Heading,
  Stack,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import {
  Column, useRowSelect, useSortBy, useTable,
} from 'react-table';
import { ArrowDownIcon, ArrowUpIcon } from '@chakra-ui/icons';
import { DashboardContent } from '@/components';
import RouteParams from '../types/RouteParams';
import { useFeed } from '@/features/feed';
import { AddFilterDialog } from '@/features/feed/components/AddFilterDialog';
import { useUpdateFeed } from '@/features/feed/hooks/useUpdateFeed';

const FeedFilters: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const {
    feed, status, error,
  } = useFeed({
    feedId,
  });
  const { t } = useTranslation();
  const {
    mutateAsync,
    status: updatingStatus,
  } = useUpdateFeed({ feedId } as { feedId: string });

  const tableData = useMemo(() => {
    if (!feed?.filters) {
      return [];
    }

    return feed.filters.map((filter) => ({
      category: filter.category,
      value: filter.value,
    }));
  }, [feed]);

  const columns = useMemo<Column<{ category: string, value: string }>[]>(() => [{
    Header: t('pages.filters.tableCategory') as string,
    accessor: 'category',
  }, {
    Header: t('pages.filters.tableValue') as string,
    accessor: 'value',
  }], []);

  const tableInstance = useTable(
    {
      columns,
      data: tableData,
    },
    useSortBy,
    useRowSelect,
    (hooks) => {
      hooks.visibleColumns.push((cols) => [
        // Let's make a column for selection
        {
          id: 'selection',
          // The header can use the table's getToggleAllRowsSelectedProps method
          // to render a checkbox
          Header: ({ getToggleAllRowsSelectedProps }) => {
            const {
              indeterminate, title, checked, onChange,
            } = getToggleAllRowsSelectedProps();

            return (
              <Checkbox
                isIndeterminate={indeterminate}
                title={title}
                isChecked={checked}
                onChange={onChange}
              />
            );
          },
          // The cell can use the individual row's getToggleRowSelectedProps method
          // to the render a checkbox
          // @ts-ignore
          Cell: ({ row }) => {
            const {
              indeterminate, title, checked, onChange,
            } = row.getToggleRowSelectedProps();

            return (
              <Checkbox
                isIndeterminate={indeterminate}
                title={title}
                isChecked={checked}
                onChange={onChange}
              />
            );
          },
        },
        ...cols,
      ]);
    },
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    rows,
    selectedFlatRows,
  } = tableInstance;

  const onAddFilters = async (data: Array<{ category: string, value: string }>) => {
    if (!feedId || !feed) {
      return;
    }

    await mutateAsync({
      feedId,
      details: {
        filters: [
          ...feed.filters,
          ...data,
        ],
      },
    });
  };

  const onRemoveFilters = async () => {
    if (!feedId || !feed) {
      return;
    }

    const newFiltersState = [...feed.filters];
    const selectedIndexes = selectedFlatRows.map((row) => row.index).sort();

    for (let i = selectedIndexes.length - 1; i >= 0; i -= 1) {
      newFiltersState.splice(selectedIndexes[i], 1);
    }

    await mutateAsync({
      feedId,
      details: {
        filters: newFiltersState,
      },
    });
  };

  return (
    <Stack>
      <DashboardContent
        error={error}
        loading={status === 'loading' || status === 'idle'}
      >
        <Stack spacing={6}>
          <Flex justifyContent="space-between">
            <Heading
              size="lg"
              marginRight={4}
            >
              {t('pages.filters.title')}
            </Heading>
            <AddFilterDialog onSubmit={onAddFilters} />
          </Flex>
          <Stack>
            <Box>
              <Button
                disabled={selectedFlatRows.length === 0 || updatingStatus === 'loading'}
                isLoading={updatingStatus === 'loading'}
                colorScheme="red"
                variant="outline"
                onClick={onRemoveFilters}
              >
                {t('pages.filters.removeSelectedFilters')}
              </Button>
            </Box>
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
                      <Th {...column.getHeaderProps(column.getSortByToggleProps())}>
                        <Flex alignItems="center" userSelect="none">
                          {column.render('Header')}
                          {column.isSorted && column.isSortedDesc && (
                          <ArrowDownIcon
                            marginLeft="1"
                          />
                          )}
                          {column.isSorted && !column.isSortedDesc && (
                          <ArrowUpIcon
                            marginLeft="1"
                          />
                          )}
                        </Flex>
                      </Th>
                    ))}
                  </Tr>
                ))}
              </Thead>
              <Tbody {...getTableBodyProps()}>
                {rows.map((row) => {
                  prepareRow(row);

                  return (
                    <Tr {...row.getRowProps()}>
                      {row.cells.map((cell) => (
                        <Td {...cell.getCellProps()}>
                          {cell.render('Cell')}
                        </Td>
                      ))}
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Stack>
        </Stack>
      </DashboardContent>
    </Stack>
  );
};

export default FeedFilters;
