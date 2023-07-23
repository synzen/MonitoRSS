/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react/jsx-props-no-spreading */
import {
  Alert,
  AlertIcon,
  ButtonGroup,
  Center,
  Flex,
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
  Button,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import {
  PaginationState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { TFunction, useTranslation } from "react-i18next";
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

const DEFAULT_MAX_PER_PAGE = 1;

const maxPerPage = DEFAULT_MAX_PER_PAGE;

type RowData = Pick<UserFeed, "title" | "url" | "id" | "disabledCode">;

const columnHelper = createColumnHelper<RowData>();

const columns = (t: TFunction) => [
  columnHelper.accessor("disabledCode", {
    cell: (info) => <UserFeedStatusTag disabledCode={info.getValue()} />,
    header: () => t("pages.feeds.tableStatus") as string,
    // footer: info => info.column.id
  }),
  columnHelper.accessor("title", {
    header: () => t("pages.feeds.tableTitle") as string,
  }),
  columnHelper.accessor("url", {
    header: () => t("pages.feeds.tableUrl") as string,
    meta: {
      data: 1,
    },
  }),
];

export const UserFeedsTable: React.FC<Props> = ({ onSelectedFeedId }) => {
  const { t } = useTranslation();
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: maxPerPage,
  });
  const { data, status, error, isFetchingNewPage, search, setSearch, isFetching } = useUserFeeds({
    limit: maxPerPage,
    offset: maxPerPage * pageIndex,
  });

  const tableData = useMemo<RowData[]>(
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

  const tableInstance = useReactTable({
    columns: columns(t),
    data: tableData,
    manualPagination: true,
    pageCount: Math.ceil(total / maxPerPage),
    getCoreRowModel: getCoreRowModel(),
    state: {
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onPaginationChange: setPagination,
    debugTable: true,
  });

  // console.log("pagecount", total, maxPerPage, Math.ceil(total / maxPerPage));

  const {
    getHeaderGroups,
    getRowModel,
    nextPage,
    previousPage,
    getPageCount,
    setGlobalFilter,
    getCanNextPage,
    getCanPreviousPage,
  } = tableInstance;

  const onClickFeedRow = (feedId: string) => {
    onSelectedFeedId?.(feedId);
  };

  const onSearchChange = debounce((value: string) => {
    setGlobalFilter(value);
    setSearch(value);
  }, 500);

  useEffect(() => {
    if (search) {
      setPagination({
        pageIndex: 0,
        pageSize: maxPerPage,
      });
    }
  }, [search, maxPerPage]);

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
        <AddUserFeedDialog totalFeeds={data?.total} />
      </HStack>
      <Box overflow="auto">
        <Table
          whiteSpace="nowrap"
          background="gray.850"
          borderColor="gray.700"
          borderWidth="2px"
          boxShadow="lg"
        >
          <Thead>
            {getHeaderGroups().map((headerGroup) => (
              <Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </Th>
                ))}
              </Tr>
            ))}
          </Thead>
          <tbody>
            {getRowModel().rows.map((row) => {
              const feed = row.original as RowData;

              return (
                <Tr
                  key={row.id}
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
                  {row.getVisibleCells().map((cell) => (
                    <Td key={cell.id} maxWidth="250px" overflow="hidden" textOverflow="ellipsis">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
          {!isFetching &&
            t("pages.feeds.tableResults", {
              start: pageIndex * maxPerPage + 1,
              end: Math.min((pageIndex + 1) * maxPerPage, total),
              total,
            })}
        </Text>
        <ButtonGroup>
          <Button
            leftIcon={<ChevronLeftIcon />}
            aria-label="Previous page"
            onClick={previousPage}
            isDisabled={isFetchingNewPage || !getCanPreviousPage()}
          >
            Previous
          </Button>
          {/* <Flex alignItems="center">
            <Text>{pageIndex + 1}</Text>/<Text>{getPageCount()}</Text>
          </Flex> */}
          <Button
            aria-label="Next page"
            onClick={nextPage}
            isDisabled={isFetchingNewPage || !getCanNextPage()}
            isLoading={isFetchingNewPage}
            rightIcon={<ChevronRightIcon />}
          >
            Next
          </Button>
        </ButtonGroup>
      </Flex>
    </Stack>
  );
};
