/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react/jsx-props-no-spreading */
import {
  Alert,
  AlertIcon,
  Center,
  Flex,
  Stack,
  Table,
  Td,
  Th,
  Thead,
  Tr,
  Box,
  Spinner,
  Button,
  Checkbox,
  Menu,
  MenuList,
  MenuItem,
  MenuButton,
  Wrap,
  HStack,
  Highlight,
  InputGroup,
  InputLeftElement,
  Input,
  InputRightElement,
  MenuDivider,
  Text,
} from "@chakra-ui/react";
import React, { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import {
  RowSelectionState,
  SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, ChevronUpIcon, DeleteIcon, SearchIcon } from "@chakra-ui/icons";
import { debounce } from "lodash";
import dayjs from "dayjs";
import { useInView } from "react-intersection-observer";
import { FaPause, FaPlay } from "react-icons/fa6";
import { useDeleteUserFeeds, useDisableUserFeeds, useEnableUserFeeds } from "../../hooks";
import { ConfirmModal, Loading } from "@/components";
import { AddUserFeedDialog } from "../AddUserFeedDialog";
import { UserFeed, UserFeedDisabledCode } from "../../types";
import { UserFeedStatusTag } from "./UserFeedStatusTag";
import { notifyError } from "../../../../utils/notifyError";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { DATE_FORMAT } from "../../../../constants";
import { useUserFeedsInfinite } from "../../hooks/useUserFeedsInfinite";

interface Props {
  onSelectedFeedId?: (feedId: string) => void;
}

const DEFAULT_MAX_PER_PAGE = 20;

const maxPerPage = DEFAULT_MAX_PER_PAGE;

type RowData = Pick<UserFeed, "title" | "url" | "id" | "disabledCode" | "createdAt">;

const columnHelper = createColumnHelper<RowData>();

const convertSortStateToSortKey = (state: SortingState) => {
  if (!state[0]) {
    return undefined;
  }

  return `${state[0].desc ? "-" : ""}${state[0].id}`;
};

export const UserFeedsTable: React.FC<Props> = ({ onSelectedFeedId }) => {
  const { t } = useTranslation();
  const { ref: scrollRef, inView } = useInView();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const {
    data,
    status,
    error,
    isFetching,
    search,
    setSearch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserFeedsInfinite({
    limit: maxPerPage,
    sort: convertSortStateToSortKey(sorting),
  });
  const { mutateAsync: deleteUserFeeds } = useDeleteUserFeeds();
  const { mutateAsync: disableUserFeeds } = useDisableUserFeeds();
  const { mutateAsync: enableUserFeeds } = useEnableUserFeeds();
  const flatData = React.useMemo(() => data?.pages?.flatMap((page) => page.results) || [], [data]);

  // called on scroll and possibly on mount to fetch more data as the user scrolls and reaches bottom of table
  const fetchMoreOnBottomReached = React.useCallback(() => {
    // if (containerRefElement) {
    if (inView && !isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
    // }
  }, [fetchNextPage, inView, isFetchingNextPage, hasNextPage]);

  // const refExists = !!scrollRef?.current;

  // // a check on mount and after a fetch to see if the table is already scrolled to the bottom and immediately needs to fetch more data
  React.useEffect(() => {
    fetchMoreOnBottomReached();
  }, [fetchMoreOnBottomReached]);

  const columns = useMemo(
    () => [
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
            marginX={3.5}
            cursor="pointer"
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
        enableSorting: false,
      }),
      columnHelper.accessor("title", {
        id: "title",
        header: () => t("pages.feeds.tableTitle") as string,
        cell: (info) => {
          const value = info.getValue();

          if (!search) {
            return value;
          }

          return (
            <Highlight query={search} styles={{ bg: "orange.100" }}>
              {value}
            </Highlight>
          );
        },
      }),
      columnHelper.accessor("url", {
        id: "url",
        header: () => t("pages.feeds.tableUrl") as string,
        cell: (info) => {
          const value = info.getValue();

          if (!search) {
            return value;
          }

          return (
            <Highlight query={search} styles={{ bg: "orange.100" }}>
              {value}
            </Highlight>
          );
        },
      }),
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: () => "Added on",
        cell: (info) => {
          const value = info.getValue();

          if (!value) {
            return null;
          }

          return dayjs(value).format(DATE_FORMAT);
        },
      }),
    ],
    [search]
  );

  const tableInstance = useReactTable({
    columns,
    data: flatData,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
      sorting,
    },
    onSortingChange: setSorting,
  });

  const { getHeaderGroups, getRowModel, getSelectedRowModel } = tableInstance;

  const selectedRows = getSelectedRowModel().flatRows;

  const onClickFeedRow = (feedId: string) => {
    onSelectedFeedId?.(feedId);
  };

  const onSearchChange = debounce((value: string) => {
    setSearch(value);
  }, 500);

  const resetUserAdjustments = useCallback(() => {
    setRowSelection({});
    setSorting([]);
  }, [setRowSelection, setSorting]);

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

    resetUserAdjustments();
  };

  const disableUserFeedsHandler = async () => {
    const feedIds = selectedRows.map((row) => row.original.id);

    try {
      await disableUserFeeds({
        data: {
          feeds: feedIds.map((id) => ({ id })),
        },
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }

    resetUserAdjustments();
  };

  const enableUserFeedsHandler = async () => {
    const feedIds = selectedRows.map((row) => row.original.id);

    try {
      await enableUserFeeds({
        data: {
          feeds: feedIds.map((id) => ({ id })),
        },
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }

    resetUserAdjustments();
  };

  useEffect(() => {
    if (search) {
      resetUserAdjustments();
    }
  }, [search, resetUserAdjustments]);

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
    <Stack spacing={4} height="100%">
      <InputGroup>
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
      <Stack>
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
              <MenuList zIndex={2}>
                <ConfirmModal
                  trigger={
                    <MenuItem
                      isDisabled={
                        !selectedRows.some(
                          (r) => r.original.disabledCode === UserFeedDisabledCode.Manual
                        )
                      }
                      icon={<FaPlay />}
                    >
                      Enable
                    </MenuItem>
                  }
                  title={`Are you sure you want to enable ${selectedRows.length} feed(s)?`}
                  description="Only feeds that were manually disabled will be enabled."
                  onConfirm={enableUserFeedsHandler}
                  colorScheme="blue"
                />
                <ConfirmModal
                  trigger={
                    <MenuItem
                      isDisabled={!selectedRows.some((r) => !r.original.disabledCode)}
                      icon={<FaPause />}
                    >
                      Disable
                    </MenuItem>
                  }
                  title={`Are you sure you want to disable ${selectedRows.length} feed(s)?`}
                  description="Only feeds that are not disabled for other reasons will be manually disabled."
                  onConfirm={disableUserFeedsHandler}
                  colorScheme="blue"
                />
                <MenuDivider />
                <ConfirmModal
                  trigger={
                    <MenuItem icon={<DeleteIcon color="red.200" />}>
                      <Text color="red.200">Delete</Text>
                    </MenuItem>
                  }
                  title={`Are you sure you want to delete ${selectedRows.length} feed(s)?`}
                  description="This action cannot be undone."
                  onConfirm={deleteUserFeedsHandler}
                  colorScheme="red"
                  okText={t("common.buttons.delete")}
                />
              </MenuList>
            </Menu>
          </Wrap>
          {/** TODO: Pass correct total feeds to prevent API call? */}
          <AddUserFeedDialog />
        </Flex>
        {/* <Stack maxWidth="200px" width="100%">
          <Heading size="sm">Filters</Heading>
          <Accordion
            defaultIndex={[0]}
            allowMultiple
            borderStyle="none"
            gap={4}
            display="flex"
            flexDirection="column"
          >
            <AccordionItem background="whiteAlpha.50" borderRadius="md" border="none">
              <h2>
                <AccordionButton>
                  <Box as="span" flex="1" textAlign="left">
                    Status
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </AccordionPanel>
            </AccordionItem>
            <AccordionItem background="whiteAlpha.50" borderRadius="md" border="none">
              <h2>
                <AccordionButton>
                  <Box as="span" flex="1" textAlign="left">
                    Section 2 title
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Stack> */}
        <Box
          boxShadow="lg"
          background="gray.850"
          borderColor="whiteAlpha.300"
          borderWidth="1px"
          borderStyle="solid"
          borderRadius="md"
          width="100%"
          mb={20}
          overflowX="auto"
        >
          <Table
            whiteSpace="nowrap"
            position="relative"
            variant="unstyled"
            overflow="auto"
            width="100%"
          >
            <Thead>
              {/** z-index is required because some icons have a higher priority */}
              {getHeaderGroups().map((headerGroup) => (
                <Tr
                  key={headerGroup.id}
                  position="sticky"
                  top={0}
                  zIndex={1}
                  background="gray.800"
                  // borderColor="gray.700"
                >
                  {headerGroup.headers.map((header) => {
                    const isSorted = header.column.getIsSorted();
                    const canSort = header.column.getCanSort();

                    let cursor: CSSProperties["cursor"] = "initial";

                    if (isFetching) {
                      cursor = "not-allowed";
                    } else if (canSort) {
                      cursor = "pointer";
                    }

                    return (
                      <Th
                        _after={{
                          borderStyle: "solid",
                          borderWidth: "1px",
                          borderColor: "gray.700",
                          bottom: 0,
                          content: '""',
                          position: "absolute",
                          width: "99.5%", // 100% will cause a horizontal scroll
                          left: 0,
                        }}
                        _before={{
                          border: "solid 10px red",
                        }}
                        key={header.id}
                        cursor={cursor}
                        onClick={header.column.getToggleSortingHandler()}
                        userSelect="none"
                        aria-label={canSort ? "sort" : undefined}
                      >
                        <HStack alignItems="center">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {isSorted === "desc" && (
                            <ChevronDownIcon
                              aria-label={isSorted ? "sorted descending" : undefined}
                              aria-hidden={!isSorted}
                              fontSize={16}
                            />
                          )}
                          {isSorted === "asc" && (
                            <ChevronUpIcon
                              aria-label={isSorted ? "sorted ascending" : undefined}
                              aria-hidden={!isSorted}
                              fontSize={16}
                            />
                          )}
                        </HStack>
                      </Th>
                    );
                  })}
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
                        paddingY={2}
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
          {isFetchingNextPage && (
            <Center>
              <Spinner margin={4} />
            </Center>
          )}
          <div ref={scrollRef} />
        </Box>
      </Stack>
    </Stack>
  );
};
