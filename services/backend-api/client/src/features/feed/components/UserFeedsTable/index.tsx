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
  MenuButton,
  HStack,
  Highlight,
  InputGroup,
  InputLeftElement,
  Input,
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
  OnChangeFn,
  RowSelectionState,
  SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CloseIcon, SearchIcon } from "@chakra-ui/icons";
import dayjs from "dayjs";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { Loading } from "@/components";
import { UserFeedComputedStatus, UserFeedSummary } from "../../types";
import { UserFeedStatusTag } from "./UserFeedStatusTag";
import { DATE_FORMAT, pages } from "../../../../constants";
import { useUserFeedsInfinite } from "../../hooks/useUserFeedsInfinite";
import { UserFeedStatusFilterContext } from "../../../../contexts";
import { useMultiSelectUserFeedContext } from "../../../../contexts/MultiSelectUserFeedContext";
import { useUserMe, useUpdateUserMe } from "../../../discordUser/hooks";

interface Props {}

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

export const UserFeedsTable: React.FC<Props> = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsSearch = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(searchParamsSearch);
  // const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const { data: userMe } = useUserMe();
  const { mutateAsync: updateUser } = useUpdateUserMe();
  const savedSortPreference = userMe?.result?.preferences?.feedListSort;
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (savedSortPreference) {
      return [{ id: savedSortPreference.key, desc: savedSortPreference.direction === "desc" }];
    }

    return [];
  });
  const { statusFilters, setStatusFilters } = useContext(UserFeedStatusFilterContext);
  const { selectedFeeds, setSelectedFeeds } = useMultiSelectUserFeedContext();
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
  const flatData = React.useMemo(() => data?.pages?.flatMap((page) => page.results) || [], [data]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <Flex justifyContent="center" alignItems="center" width="100%">
            <Checkbox
              alignItems="center"
              width="min-content"
              isChecked={table.getIsAllRowsSelected()}
              onChange={(e) => {
                e.stopPropagation();
                table.getToggleAllRowsSelectedHandler()(e);
              }}
              isIndeterminate={table.getIsSomeRowsSelected()}
              cursor="pointer"
              aria-label="Check all currently loaded feeds for bulk actions"
            />
          </Flex>
        ),
        cell: ({ row }) => (
          <Flex
            alignItems="center"
            justifyContent="center"
            onClick={(e) => {
              /**
               * Stopping propagation at the checkbox level does not work for some reason with
               * chakra checkboxes. This will cause the row to be clicked.
               */
              e.stopPropagation();
            }}
          >
            <Checkbox
              display="flex"
              alignItems="center"
              // width="min-content"
              isChecked={row.getIsSelected()}
              aria-disabled={!row.getCanSelect()}
              onChange={(e) => {
                if (!row.getCanSelect()) {
                  return;
                }

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
          </Flex>
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
                color="blue.300"
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
                  color="blue.300"
                  title={info.row.original.inputUrl || value}
                  onClick={(e) => e.stopPropagation()}
                  overflow="hidden"
                  textOverflow="ellipsis"
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

  const rowSelection = selectedFeeds.reduce((acc, feed) => {
    acc[feed.id] = true;

    return acc;
  }, {} as Record<string, boolean>);

  const onRowSelectionChange: OnChangeFn<RowSelectionState> = (newValOrUpdater) => {
    if (typeof newValOrUpdater === "function") {
      const newVal = newValOrUpdater(rowSelection);

      setSelectedFeeds(flatData.filter((feed) => newVal[feed.id]));
    } else {
      setSelectedFeeds(flatData.filter((r) => newValOrUpdater[r.id]));
    }
  };

  const tableInstance = useReactTable({
    columns,
    data: flatData,
    manualSorting: true,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    onRowSelectionChange,
    state: {
      rowSelection,
      sorting,
    },
    onSortingChange: setSorting,
  });

  const { getHeaderGroups, getRowModel, getSelectedRowModel } = tableInstance;

  const selectedRows = getSelectedRowModel().flatRows;

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

  // Sync sorting when saved preference loads/changes
  useEffect(() => {
    if (savedSortPreference) {
      setSorting([{ id: savedSortPreference.key, desc: savedSortPreference.direction === "desc" }]);
    }
  }, [savedSortPreference?.key, savedSortPreference?.direction]);

  // Save sorting preference when it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newPreference = sorting[0]
        ? { key: sorting[0].id, direction: (sorting[0].desc ? "desc" : "asc") as "asc" | "desc" }
        : null;

      // Only save if different from current saved value
      const currentKey = savedSortPreference?.key;
      const currentDirection = savedSortPreference?.direction;
      const newKey = newPreference?.key;
      const newDirection = newPreference?.direction;

      if (currentKey !== newKey || currentDirection !== newDirection) {
        updateUser({
          details: {
            preferences: {
              feedListSort: newPreference,
            },
          },
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [sorting, savedSortPreference, updateUser]);

  const selectedFeedIds = selectedRows.map((row) => row.original.id);

  useEffect(() => {
    setSelectedFeeds(selectedRows.map((r) => r.original));
  }, [JSON.stringify(selectedFeedIds)]);

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
            Loaded table with {flatData.length} of {data?.pages[0].total} feeds
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
        <HStack flexWrap="wrap">
          <Flex as="fieldset" width="100%" flex={1}>
            <InputGroup width="min-content" flex={1}>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                onChange={({ target: { value } }) => {
                  onSearchChange(value);
                }}
                value={searchInput || ""}
                minWidth="150px"
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
            <Button leftIcon={<SearchIcon />} type="submit" ml={1}>
              Search
            </Button>
          </Flex>
          <Flex>
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
          </Flex>
        </HStack>
      </form>
      <Center mt={4} hidden={!isInitiallyLoading}>
        <Stack alignItems="center">
          <Loading />
          <Text>Loading feeds...</Text>
        </Stack>
      </Center>
      <Stack hidden={isInitiallyLoading}>
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
                return (
                  <Tr key={row.id}>
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
          isDisabled={
            !hasNextPage ||
            isFetchingNextPage ||
            (data?.pages[0].total != null && data.pages[0].total === flatData.length)
          }
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
