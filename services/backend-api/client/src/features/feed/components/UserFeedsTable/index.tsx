/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react/jsx-props-no-spreading */
import {
  Alert,
  AlertIcon,
  ButtonGroup,
  Center,
  Flex,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Table,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Box,
  InputRightElement,
  Spinner,
  HStack,
} from "@chakra-ui/react";
import { useEffect, useMemo } from "react";
import { useTable, usePagination, Column, useGlobalFilter } from "react-table";
import { useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "@chakra-ui/icons";
import { debounce } from "lodash";
import { useUserFeeds } from "../../hooks";
import { Loading } from "@/components";
import { AddUserFeedDialog } from "../AddUserFeedDialog";
import { UserFeed } from "../../types";
import { UserFeedStatusTag } from "./UserFeedStatusTag";

interface Props {
  onSelectedFeedId?: (feedId: string) => void;
}

const DEFAULT_MAX_PER_PAGE = 10;

const maxPerPage = DEFAULT_MAX_PER_PAGE;

export const UserFeedsTable: React.FC<Props> = ({ onSelectedFeedId }) => {
  const { t } = useTranslation();
  const { data, status, error, setOffset, isFetchingNewPage, search, setSearch, isFetching } =
    useUserFeeds({
      initialLimit: maxPerPage,
    });

  const tableData = useMemo(
    () =>
      (data?.results || []).map((feed) => ({
        id: feed.id,
        disabledCode: feed.disabledCode,
        title: feed.title,
        url: feed.url,
      })),
    [data]
  );

  const total = data?.total || 0;

  const columns = useMemo<Column<Pick<UserFeed, "title" | "url" | "id" | "disabledCode">>[]>(
    () => [
      {
        Header: t("pages.feeds.tableStatus") as string,
        accessor: "disabledCode", // accessor is the "key" in the data
        Cell: ({ cell: { value } }) => <UserFeedStatusTag disabledCode={value} />,
      },
      {
        Header: t("pages.feeds.tableTitle") as string,
        accessor: "title",
      },
      {
        Header: t("pages.feeds.tableUrl") as string,
        accessor: "url",
      },
    ],
    []
  );

  const tableInstance = useTable(
    {
      columns,
      data: tableData,
      manualPagination: true,
      manualGlobalFilter: true,
      pageCount: Math.ceil(total / maxPerPage),
      initialState: {
        pageSize: maxPerPage,
      },
    },
    useGlobalFilter,
    usePagination
  );

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
    setGlobalFilter,
    state: { pageIndex },
  } = tableInstance;

  useEffect(() => {
    setOffset(pageIndex * maxPerPage);
  }, [pageIndex]);

  const onClickFeedRow = (feedId: string) => {
    onSelectedFeedId?.(feedId);
  };

  const onSearchChange = debounce((value: string) => {
    setGlobalFilter(value);
    setSearch(value);
  }, 500);

  if (status === "loading") {
    return (
      <Center width="100%" height="100%">
        <Loading size="lg" />
      </Center>
    );
  }

  if (status === "error") {
    return (
      <Alert status="error">
        <AlertIcon />
        {error?.message}
      </Alert>
    );
  }

  return (
    <Stack>
      <HStack justifyContent="space-between" flexWrap="wrap" gap="0">
        <InputGroup width="min-content">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            onChange={({ target: { value } }) => {
              onSearchChange(value);
            }}
            minWidth="325px"
            placeholder={t("pages.feeds.tableSearch")}
          />
          <InputRightElement>{search && isFetching && <Spinner size="sm" />}</InputRightElement>
        </InputGroup>
        <AddUserFeedDialog />
      </HStack>
      <Box overflow="auto">
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
                  <Th {...column.getHeaderProps()}>{column.render("Header")}</Th>
                ))}
              </Tr>
            ))}
          </Thead>
          <tbody {...getTableBodyProps()}>
            {page.map((row) => {
              prepareRow(row);
              const feed = row.original;

              return (
                <Tr
                  {...row.getRowProps()}
                  tabIndex={0}
                  zIndex={100}
                  position="relative"
                  _hover={{
                    bg: "gray.700",
                    cursor: "pointer",
                    boxShadow: "outline",
                  }}
                  _focus={{
                    boxShadow: "outline",
                    outline: "none",
                  }}
                  onClick={() => onClickFeedRow(feed.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onClickFeedRow(feed.id);
                    }
                  }}
                >
                  {row.cells.map((cell) => (
                    <Td
                      {...cell.getCellProps()}
                      maxWidth="250px"
                      overflow="hidden"
                      textOverflow="ellipsis"
                    >
                      {cell.render("Cell")}
                    </Td>
                  ))}
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Box>
      <Flex justifyContent="space-between" flexWrap="wrap">
        <Text marginBottom="4">
          {t("pages.feeds.tableResults", {
            start: pageIndex * maxPerPage + 1,
            end: Math.min((pageIndex + 1) * maxPerPage, total),
            total,
          })}
        </Text>
        <ButtonGroup>
          <IconButton
            icon={<ChevronLeftIcon />}
            aria-label="Previous page"
            onClick={previousPage}
            isDisabled={isFetchingNewPage || !canPreviousPage}
          />
          <Flex alignItems="center">
            <Text>{pageIndex + 1}</Text>/<Text>{Math.ceil(total / maxPerPage)}</Text>
          </Flex>
          <IconButton
            icon={<ChevronRightIcon />}
            aria-label="Next page"
            onClick={nextPage}
            disabled={isFetchingNewPage || !canNextPage}
            isLoading={isFetchingNewPage}
          />
        </ButtonGroup>
      </Flex>
    </Stack>
  );
};
