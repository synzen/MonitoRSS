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
  Button,
  Checkbox,
  Menu,
  MenuList,
  MenuItem,
  MenuButton,
  Wrap,
} from "@chakra-ui/react";
import React, { useEffect, useMemo, useState } from "react";
import {
  PaginationState,
  RowSelectionState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DeleteIcon,
  SearchIcon,
} from "@chakra-ui/icons";
import { debounce } from "lodash";
import { TFunction } from "i18next";
import { useDeleteUserFeeds, useUserFeeds } from "../../hooks";
import { ConfirmModal, Loading } from "@/components";
import { AddUserFeedDialog } from "../AddUserFeedDialog";
import { UserFeed } from "../../types";
import { UserFeedStatusTag } from "./UserFeedStatusTag";
import { notifyError } from "../../../../utils/notifyError";
import { notifySuccess } from "../../../../utils/notifySuccess";

interface Props {
  onSelectedFeedId?: (feedId: string) => void;
}

const DEFAULT_MAX_PER_PAGE = 1;

const maxPerPage = DEFAULT_MAX_PER_PAGE;

type RowData = Pick<UserFeed, "title" | "url" | "id" | "disabledCode">;

const columnHelper = createColumnHelper<RowData>();

const columns = (t: TFunction) => [
  columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <Checkbox
        as={Flex}
        alignItems="center"
        width="min-content"
        isChecked={table.getIsAllRowsSelected()}
        // onChange will not work for some reason with chakra checkboxes
        onChangeCapture={(e) => {
          e.stopPropagation();
          table.getToggleAllRowsSelectedHandler()(e);
        }}
        isIndeterminate={table.getIsSomeRowsSelected()}
        padding={3.5}
        cursor="pointer"
        __css={{
          _hover: {
            background: "whiteAlpha.300",
            borderRadius: "full",
          },
        }}
      />
    ),
    cell: ({ row }) => (
      <Box
        onClick={(e) => {
          /**
           * Stopping propagation at the checkbox level does not work for some reason with
           * chakra checkboxes. This will cause the row to be clicked.
           */
          e.stopPropagation();
        }}
      >
        <Checkbox
          as={Flex}
          alignItems="center"
          width="min-content"
          isChecked={row.getIsSelected()}
          isDisabled={!row.getCanSelect()}
          zIndex={100}
          // onChange will not work for some reason with chakra checkboxes
          onChangeCapture={(e) => {
            e.stopPropagation();
            row.getToggleSelectedHandler()(e);
          }}
          isIndeterminate={row.getIsSomeSelected()}
          padding={3.5}
          cursor="pointer"
          __css={{
            _hover: {
              background: "whiteAlpha.300",
              borderRadius: "full",
            },
          }}
        />
      </Box>
    ),
  }),
  columnHelper.accessor("disabledCode", {
    cell: (info) => <UserFeedStatusTag disabledCode={info.getValue()} />,
    header: () => t("pages.feeds.tableStatus") as string,
  }),
  columnHelper.accessor("title", {
    header: () => t("pages.feeds.tableTitle") as string,
  }),
  columnHelper.accessor("url", {
    header: () => t("pages.feeds.tableUrl") as string,
  }),
];

export const UserFeedsTable: React.FC<Props> = ({ onSelectedFeedId }) => {
  const { t } = useTranslation();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: maxPerPage,
  });
  const { data, status, error, isFetchingNewPage, search, setSearch, isFetching } = useUserFeeds({
    limit: maxPerPage,
    offset: maxPerPage * pageIndex,
  });
  const { mutateAsync: deleteUserFeeds } = useDeleteUserFeeds();

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
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onPaginationChange: setPagination,
  });

  const {
    getHeaderGroups,
    getRowModel,
    nextPage,
    previousPage,
    getCanNextPage,
    getCanPreviousPage,
    getSelectedRowModel,
  } = tableInstance;
  const selectedRows = getSelectedRowModel().flatRows;

  const onClickFeedRow = (feedId: string) => {
    onSelectedFeedId?.(feedId);
  };

  const onSearchChange = debounce((value: string) => {
    setSearch(value);
  }, 500);

  const deleteUserFeedsHandler = async () => {
    const feedIds = selectedRows.map((row) => row.original.id);

    try {
      await deleteUserFeeds({
        data: {
          feeds: feedIds.map((id) => ({ id })),
        },
      });
      notifySuccess(t("common.success.deleted"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }

    setRowSelection({});
  };

  useEffect(() => {
    if (search) {
      setPagination({
        pageIndex: 0,
        pageSize: maxPerPage,
      });
      setRowSelection({});
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
    <Stack mb={6}>
      <Flex justifyContent="space-between" flexWrap="wrap" width="100%" gap={4}>
        <Wrap>
          <Menu>
            <MenuButton
              as={Button}
              aria-label="Options"
              rightIcon={<ChevronDownIcon />}
              variant="outline"
              isDisabled={selectedRows.length === 0}
            >
              Bulk Actions
            </MenuButton>
            <MenuList>
              <ConfirmModal
                trigger={<MenuItem icon={<DeleteIcon />}>Delete</MenuItem>}
                title={`Are you sure you want to delete ${selectedRows.length} feed(s)?`}
                description="This action cannot be undone."
                onConfirm={deleteUserFeedsHandler}
                colorScheme="red"
                okText={t("common.buttons.delete")}
              />
            </MenuList>
          </Menu>
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
        </Wrap>
        <AddUserFeedDialog totalFeeds={data?.total} />
      </Flex>
      <Box>
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
                  _hover={{
                    bg: "gray.700",
                    cursor: "pointer",
                    // boxShadow: "outline",
                  }}
                  _focus={{
                    // boxShadow: "outline",
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
                    <Td
                      paddingY={0}
                      paddingX="24px"
                      key={cell.id}
                      maxWidth="250px"
                      overflow="hidden"
                      textOverflow="ellipsis"
                    >
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
          {!isFetching ? (
            t("pages.feeds.tableResults", {
              start: pageIndex * maxPerPage + 1,
              end: Math.min((pageIndex + 1) * maxPerPage, total),
              total,
            })
          ) : (
            <Spinner size="sm" />
          )}
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
