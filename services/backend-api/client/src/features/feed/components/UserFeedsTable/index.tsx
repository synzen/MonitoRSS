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
  HStack,
  Highlight,
  InputGroup,
  InputLeftElement,
  Input,
  MenuDivider,
  Text,
  IconButton,
  MenuOptionGroup,
  MenuItemOption,
  InputRightElement,
  Link,
  chakra,
} from "@chakra-ui/react";
import React, { CSSProperties, useContext, useEffect, useMemo, useState } from "react";
import {
  RowSelectionState,
  SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  DeleteIcon,
  SearchIcon,
} from "@chakra-ui/icons";
import dayjs from "dayjs";
import { FaPause, FaPlay } from "react-icons/fa6";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useDeleteUserFeeds, useDisableUserFeeds, useEnableUserFeeds } from "../../hooks";
import { ConfirmModal, Loading } from "@/components";
import { UserFeedComputedStatus, UserFeedDisabledCode, UserFeedSummary } from "../../types";
import { UserFeedStatusTag } from "./UserFeedStatusTag";
import { notifyError } from "../../../../utils/notifyError";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { DATE_FORMAT, pages } from "../../../../constants";
import { useUserFeedsInfinite } from "../../hooks/useUserFeedsInfinite";
import { UserFeedStatusFilterContext } from "../../../../contexts";

interface Props {
  onSelectedFeedId?: (feedId: string, openNewTab?: boolean) => void;
}

const DEFAULT_MAX_PER_PAGE = 20;

const maxPerPage = DEFAULT_MAX_PER_PAGE;

type RowData = UserFeedSummary;

const columnHelper = createColumnHelper<RowData>();

const convertSortStateToSortKey = (state: SortingState) => {
  if (!state[0]) {
    return undefined;
  }

  return `${state[0].desc ? "-" : ""}${state[0].id}`;
};

const STATUS_FILTERS = [
  {
    label: "Ok",
    description: "Working as expected",
    value: UserFeedComputedStatus.Ok,
  },
  {
    label: "Failed",
    description: "Disabled after too many failures",
    value: UserFeedComputedStatus.RequiresAttention,
  },
  {
    label: "Pending Retry",
    description: "Currently unable to fetch the feed and is pending a retry",
    value: UserFeedComputedStatus.Retrying,
  },
  {
    label: "Manually Disabled",
    description: "Manually disabled",
    value: UserFeedComputedStatus.ManuallyDisabled,
  },
];

export const UserFeedsTable: React.FC<Props> = ({ onSelectedFeedId }) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsSearch = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(searchParamsSearch);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const { statusFilters, setStatusFilters } = useContext(UserFeedStatusFilterContext);
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
    filters: {
      computedStatuses: statusFilters,
    },
  });
  const { mutateAsync: deleteUserFeeds } = useDeleteUserFeeds();
  const { mutateAsync: disableUserFeeds } = useDisableUserFeeds();
  const { mutateAsync: enableUserFeeds } = useEnableUserFeeds();
  const flatData = React.useMemo(() => data?.pages?.flatMap((page) => page.results) || [], [data]);

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
            aria-label="Check all currently loaded feeds for bulk actions"
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
              aria-label={`Check feed ${row.original.title} for bulk actions`}
            />
          </Box>
        ),
      }),
      columnHelper.accessor("computedStatus", {
        header: () => <span>{t("pages.feeds.tableStatus")}</span>,
        cell: (info) => <UserFeedStatusTag status={info.getValue()} />,
      }),
      columnHelper.accessor("title", {
        id: "title",
        header: () => <span>{t("pages.feeds.tableTitle")}</span>,
        cell: (info) => {
          const value = info.getValue();

          if (!search) {
            return (
              <Link
                as={RouterLink}
                to={pages.userFeed(info.row.original.id)}
                _hover={{
                  textDecoration: "underline",
                }}
              >
                {value}
              </Link>
            );
          }

          return (
            <Link
              as={RouterLink}
              to={pages.userFeed(info.row.original.id)}
              _hover={{
                textDecoration: "underline",
              }}
            >
              <Highlight query={search} styles={{ bg: "orange.100" }}>
                {value}
              </Highlight>
            </Link>
          );
        },
      }),
      columnHelper.accessor("url", {
        id: "url",
        header: () => <span>{t("pages.feeds.tableUrl")}</span>,
        cell: (info) => {
          const value = info.getValue();

          const urlIsDifferentFromInput = info.row.original.inputUrl !== value;

          if (!search) {
            return (
              <Stack>
                <Link
                  as="a"
                  target="_blank"
                  href={info.row.original.inputUrl || value}
                  _hover={{
                    textDecoration: "underline",
                  }}
                  title={info.row.original.inputUrl || value}
                  onClick={(e) => e.stopPropagation()}
                >
                  {info.row.original.inputUrl || value}
                </Link>
                {urlIsDifferentFromInput && (
                  <Text
                    color="whiteAlpha.600"
                    fontSize="sm"
                    display="inline"
                    overflow="hidden"
                    textOverflow="ellipsis"
                  >
                    Resolved to{" "}
                    <Link
                      as="a"
                      fontSize="sm"
                      target="_blank"
                      href={value}
                      color="whiteAlpha.600"
                      _hover={{
                        textDecoration: "underline",
                      }}
                      title={value}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {value}
                    </Link>
                  </Text>
                )}
              </Stack>
            );
          }

          return (
            <Link
              as="a"
              target="_blank"
              href={value}
              _hover={{
                textDecoration: "underline",
              }}
            >
              <Highlight query={search} styles={{ bg: "orange.100" }}>
                {value}
              </Highlight>
            </Link>
          );
        },
      }),
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: () => <span>Added on</span>,
        cell: (info) => {
          const value = info.getValue();

          if (!value) {
            return null;
          }

          return <span>{dayjs(value).format(DATE_FORMAT)}</span>;
        },
      }),
      columnHelper.accessor("ownedByUser", {
        id: "ownedByUser",
        header: () => <span>Shared with Me</span>,
        cell: (info) => {
          const isOwnedByCurrentUser = info.getValue();

          return isOwnedByCurrentUser ? null : <CheckIcon />;
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

  const onSearchChange = (val: string) => {
    setSearchInput(val);
  };

  const onSearchClear = () => {
    setSearchInput("");
    onSearchSubmit("");
  };

  const onSearchSubmit = (val?: string) => {
    const useVal = val ?? searchInput;
    setSearchParams({ ...searchParams, search: useVal });
  };

  const deleteUserFeedsHandler = async () => {
    const feedIds = selectedRows.map((row) => row.original.id);

    try {
      await deleteUserFeeds({
        data: {
          feeds: feedIds.map((id) => ({ id })),
        },
      });
      setRowSelection({});
      notifySuccess(t("common.success.deleted"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
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
  };

  const onStatusSelect = (statuses: string[] | string) => {
    if (typeof statuses === "string") {
      setStatusFilters([statuses as UserFeedComputedStatus]);

      return;
    }

    setStatusFilters(statuses as UserFeedComputedStatus[]);
  };

  useEffect(() => {
    setSearch(searchParamsSearch);
  }, [searchParamsSearch, setSearch]);

  if (status === "error") {
    return (
      <Alert status="error">
        <AlertIcon />
        {error?.message}
      </Alert>
    );
  }

  const isInitiallyLoading = status === "loading" && !data;

  return (
    <Stack spacing={4}>
      <Box srOnly aria-live="polite">
        {!isInitiallyLoading && (
          <Text>
            Loaded table with {flatData.length} of {data?.pages[0].total} feeds loaded
          </Text>
        )}
      </Box>
      <form
        hidden={isInitiallyLoading}
        id="user-feed-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
      >
        <HStack as="fieldset" width="100%">
          <InputGroup width="min-content" flex={1}>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              onChange={({ target: { value } }) => {
                onSearchChange(value);
              }}
              value={searchInput || ""}
              minWidth="250px"
              placeholder={t("pages.feeds.tableSearch")}
            />
            {search && !isFetching && (
              <InputRightElement>
                <IconButton
                  aria-label="Clear search"
                  icon={<CloseIcon color="gray.400" />}
                  size="sm"
                  variant="link"
                  onClick={() => {
                    onSearchClear();
                  }}
                />
              </InputRightElement>
            )}
            {search && isFetching && (
              <InputRightElement>
                <Spinner size="sm" />
              </InputRightElement>
            )}
          </InputGroup>
          <Button leftIcon={<SearchIcon />} type="submit">
            Search
          </Button>
        </HStack>
      </form>
      <Center mt={4} hidden={!isInitiallyLoading}>
        <Stack alignItems="center">
          <Loading />
          <Text>Loading feeds...</Text>
        </Stack>
      </Center>
      <Stack hidden={isInitiallyLoading}>
        <Flex justifyContent="space-between" flexWrap="wrap" width="100%" gap={4}>
          <HStack justifyContent="space-between" flexWrap="wrap" flex={1}>
            <Menu>
              <MenuButton
                as={Button}
                rightIcon={<ChevronDownIcon />}
                variant="outline"
                isDisabled={selectedRows.length === 0}
              >
                Bulk Feed Actions
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
                  description="Only feeds that are not currently disabled will be affected."
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
            <Menu closeOnSelect={false}>
              <MenuButton as={Button} rightIcon={<ChevronDownIcon />} maxWidth={200} width="100%">
                <Text
                  overflow="hidden"
                  textAlign="left"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {statusFilters?.length
                    ? `Status: ${statusFilters.length} selected`
                    : "Filter by Status"}
                </Text>
              </MenuButton>
              <MenuList maxW="300px">
                <MenuOptionGroup
                  type="checkbox"
                  onChange={(s) => onStatusSelect(s)}
                  value={statusFilters}
                >
                  {STATUS_FILTERS.map((val) => (
                    <MenuItemOption key={val.value} value={val.value}>
                      <Stack>
                        <HStack alignItems="center">
                          <UserFeedStatusTag status={val.value} />
                          <chakra.span>{val.label}</chakra.span>
                        </HStack>
                        <chakra.span display="block" color="whiteAlpha.600">
                          {val.description}
                        </chakra.span>
                      </Stack>
                    </MenuItemOption>
                  ))}
                </MenuOptionGroup>
              </MenuList>
            </Menu>
          </HStack>
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
          overflowX="auto"
        >
          <Table
            whiteSpace="nowrap"
            position="relative"
            variant="simple"
            overflow="auto"
            width="100%"
          >
            <Thead>
              {/** z-index is required because some icons have a higher priority */}
              {getHeaderGroups().map((headerGroup) => (
                <Tr key={headerGroup.id} zIndex={1}>
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
        </Box>
      </Stack>
      <Stack hidden={isInitiallyLoading}>
        <Center>
          <Text color="whiteAlpha.600" fontSize="sm">
            Viewed {flatData.length} of {data?.pages[0].total || 0} feeds
          </Text>
        </Center>
        <Button
          isDisabled={!hasNextPage || isFetchingNextPage}
          isLoading={isFetchingNextPage}
          onClick={() => fetchNextPage()}
          mb={20}
        >
          <span>Load More</span>
        </Button>
      </Stack>
    </Stack>
  );
};
