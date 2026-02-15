import { Alert, AlertIcon, Box, Center, Stack, Table, Td, Thead, Tr, Text } from "@chakra-ui/react";
import React, { useCallback, useContext, useEffect, useMemo } from "react";
import {
  OnChangeFn,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToHorizontalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { Loading } from "@/components";
import { UserFeedComputedStatus } from "../../types";
import { UserFeedStatusFilterContext } from "../../../../contexts";
import { useMultiSelectUserFeedContext } from "../../../../contexts/MultiSelectUserFeedContext";
import { useTablePreferences, useTableSearch, useFeedTableData } from "./hooks";
import { SortableTableHeader, TableToolbar, LoadMoreSection } from "./components";
import { createTableColumns } from "./columns";

export const UserFeedsTable: React.FC = () => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const { statusFilters, setStatusFilters } = useContext(UserFeedStatusFilterContext);
  const { selectedFeeds, setSelectedFeeds } = useMultiSelectUserFeedContext();

  // Preferences (sorting, column visibility, column order)
  const {
    sorting,
    setSorting,
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
  } = useTablePreferences();

  // Data fetching
  const {
    data,
    flatData,
    total,
    status,
    error,
    isFetching,
    search,
    setSearch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeedTableData({
    sorting,
    statusFilters,
  });

  // Search state
  const {
    searchInput,
    search: urlSearch,
    setSearchInput,
    onSearchSubmit,
    onSearchClear,
  } = useTableSearch({
    onSearchChange: useCallback((s: string) => setSearch(s), [setSearch]),
  });

  // Columns with search highlighting
  const columns = useMemo(() => createTableColumns(search), [search]);

  // Row selection sync with context
  const rowSelection = useMemo(
    () =>
      selectedFeeds.reduce(
        (acc, feed) => {
          acc[feed.id] = true;

          return acc;
        },
        {} as Record<string, boolean>,
      ),
    [selectedFeeds],
  );

  const onRowSelectionChange: OnChangeFn<RowSelectionState> = useCallback(
    (newValOrUpdater) => {
      if (typeof newValOrUpdater === "function") {
        const newVal = newValOrUpdater(rowSelection);
        setSelectedFeeds(flatData.filter((feed) => newVal[feed.id]));
      } else {
        setSelectedFeeds(flatData.filter((r) => newValOrUpdater[r.id]));
      }
    },
    [rowSelection, flatData, setSelectedFeeds],
  );

  // Column drag-and-drop handler
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id && active.id !== "select" && over.id !== "select") {
        setColumnOrder((currentOrder) => {
          const oldIndex = currentOrder.indexOf(active.id as string);
          const newIndex = currentOrder.indexOf(over.id as string);

          return arrayMove(currentOrder, oldIndex, newIndex);
        });
      }
    },
    [setColumnOrder],
  );

  // Table instance
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
      columnVisibility,
      columnOrder,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
  });

  const { getHeaderGroups, getRowModel, getSelectedRowModel } = tableInstance;
  const selectedRows = getSelectedRowModel().flatRows;

  // Sync selected rows to context
  const selectedFeedIds = useMemo(() => selectedRows.map((row) => row.original.id), [selectedRows]);

  useEffect(() => {
    setSelectedFeeds(selectedRows.map((r) => r.original));
  }, [JSON.stringify(selectedFeedIds)]);

  // Status filter handler
  const onStatusSelect = useCallback(
    (statuses: UserFeedComputedStatus[]) => {
      setStatusFilters(statuses);
    },
    [setStatusFilters],
  );

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
            Loaded table with {flatData.length} of {total} feeds
          </Text>
        )}
      </Box>
      {!isInitiallyLoading && (
        <TableToolbar
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onSearchSubmit={onSearchSubmit}
          onSearchClear={onSearchClear}
          search={urlSearch}
          isFetching={isFetching}
          statusFilters={statusFilters}
          onStatusSelect={onStatusSelect}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
        />
      )}
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
              {getHeaderGroups().map((headerGroup) => (
                <Tr key={headerGroup.id} zIndex={1}>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
                  >
                    <SortableContext
                      items={headerGroup.headers.map((h) => h.id)}
                      strategy={horizontalListSortingStrategy}
                    >
                      {headerGroup.headers.map((header) => (
                        <SortableTableHeader
                          key={header.id}
                          header={header}
                          isFetching={isFetching}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </Tr>
              ))}
            </Thead>
            <tbody>
              {getRowModel().rows.map((row) => (
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
              ))}
            </tbody>
          </Table>
        </Box>
      </Stack>
      {!isInitiallyLoading && (
        <LoadMoreSection
          loadedCount={flatData.length}
          totalCount={total}
          hasNextPage={hasNextPage ?? false}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
        />
      )}
    </Stack>
  );
};
