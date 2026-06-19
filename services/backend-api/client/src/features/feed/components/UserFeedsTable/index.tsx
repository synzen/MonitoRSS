import { Box, Center, Stack, Table, Text } from "@chakra-ui/react";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Alert } from "@/components/ui/alert";
import { Loading } from "@/components";
import { Panel } from "@/components/Panel";
import { UserFeedComputedStatus } from "../../types";
import { UserFeedStatusFilterContext } from "../../contexts/UserFeedStatusFilterContext";
import { useMultiSelectUserFeedContext } from "../../contexts/MultiSelectUserFeedContext";
import { useFeedScope } from "../../contexts/FeedScopeContext";
import { useTablePreferences, useTableSearch, useFeedTableData } from "./hooks";
import {
  ActiveFilterChips,
  FilteredEmptyState,
  SortableTableHeader,
  TableToolbar,
  LoadMoreSection,
} from "./components";
import { createTableColumns } from "./columns";

export const UserFeedsTable: React.FC = () => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const { statusFilters, setStatusFilters } = useContext(UserFeedStatusFilterContext);
  const { rowSelection, setRowSelection, setLoadedFeeds } = useMultiSelectUserFeedContext();
  const { workspaceSlug } = useFeedScope();

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

  const [, setSearchParams] = useSearchParams();

  const handleSearchForNewFeed = useCallback(
    (term: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("addFeed", term);

        return next;
      });
    },
    [setSearchParams],
  );

  // Columns with search highlighting; links stay in the current (workspace) scope.
  const columns = useMemo(
    () => createTableColumns(search, workspaceSlug ? { workspaceSlug } : undefined),
    [search, workspaceSlug],
  );

  const searchInputRef = useRef<HTMLInputElement>(null);

  const hasActiveFilters = !!urlSearch || statusFilters.length > 0;

  // Selection is owned by the multi-select context as a feed-id map (TanStack's
  // native RowSelectionState). The table is the controlled view of it: toggles
  // write the next id map straight through, never touching the loaded data, so
  // there is no stale-data race. The context derives the selected feed objects
  // by intersecting these ids with the loaded feeds published below.
  const onRowSelectionChange: OnChangeFn<RowSelectionState> = setRowSelection;

  // Column drag-and-drop handler
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      const isFixed = (id: string | number) => id === "select" || id === "configure";

      if (over && active.id !== over.id && !isFixed(active.id) && !isFixed(over.id)) {
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

  const { getHeaderGroups, getRowModel } = tableInstance;

  // Publish the loaded feeds so the context can derive the selected feed objects
  // (selected ids ∩ loaded feeds). When a bulk delete drops feeds from the list,
  // they fall out of the derived selection on the next render with no pruning.
  useEffect(() => {
    setLoadedFeeds(flatData);
  }, [flatData, setLoadedFeeds]);

  // Status filter handler
  const onStatusSelect = useCallback(
    (statuses: UserFeedComputedStatus[]) => {
      setStatusFilters(statuses);
    },
    [setStatusFilters],
  );

  const isInitiallyLoading = status === "loading" && !data;

  const isFilteredEmpty = !isInitiallyLoading && flatData.length === 0 && hasActiveFilters;

  const [tableAnnouncement, setTableAnnouncement] = useState("");
  const pendingAnnouncement = useRef(true);

  useEffect(() => {
    pendingAnnouncement.current = true;
  }, [urlSearch, statusFilters]);

  useEffect(() => {
    if (isInitiallyLoading || isFetching) return;

    if (!pendingAnnouncement.current) return;
    pendingAnnouncement.current = false;

    if (isFilteredEmpty) {
      setTableAnnouncement("No feeds match current filters");
    } else if (hasActiveFilters) {
      setTableAnnouncement(`Showing ${flatData.length} of ${total} feeds`);
    } else {
      setTableAnnouncement(`Loaded table with ${flatData.length} of ${total} feeds`);
    }
  }, [isInitiallyLoading, isFetching, isFilteredEmpty, hasActiveFilters, flatData.length, total]);

  const handleClearAllFilters = useCallback(() => {
    onSearchClear();
    onStatusSelect([]);
    searchInputRef.current?.focus();
  }, [onSearchClear, onStatusSelect]);

  if (status === "error") {
    return <Alert status="error" title={error?.message} />;
  }

  return (
    <Stack gap={4}>
      <Box srOnly aria-live="polite">
        <Text>{tableAnnouncement}</Text>
      </Box>
      {!isInitiallyLoading && (
        <TableToolbar
          searchInputRef={searchInputRef}
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
      {!isInitiallyLoading && hasActiveFilters && (
        <ActiveFilterChips
          search={urlSearch}
          onSearchClear={onSearchClear}
          statusFilters={statusFilters}
          onStatusFiltersClear={() => onStatusSelect([])}
          searchInputRef={searchInputRef}
        />
      )}
      <Center mt={4} hidden={!isInitiallyLoading}>
        <Stack alignItems="center">
          <Loading />
          <Text>Loading feeds...</Text>
        </Stack>
      </Center>
      {isFilteredEmpty && (
        <FilteredEmptyState
          onClearAllFilters={handleClearAllFilters}
          searchTerm={urlSearch}
          onSearchForNewFeed={handleSearchForNewFeed}
        />
      )}
      <Stack hidden={isInitiallyLoading || isFilteredEmpty}>
        <Panel boxShadow="lg" width="100%" overflowX="auto">
          <Table.Root
            whiteSpace="nowrap"
            position="relative"
            variant="line"
            overflow="auto"
            width="100%"
          >
            <Table.Header>
              {getHeaderGroups().map((headerGroup) => (
                <Table.Row key={headerGroup.id} zIndex={1}>
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
                </Table.Row>
              ))}
            </Table.Header>
            <Table.Body>
              {getRowModel().rows.map((row) => (
                <Table.Row key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <Table.Cell
                      paddingY={2}
                      paddingX="24px"
                      key={cell.id}
                      maxWidth="250px"
                      overflow="hidden"
                      textOverflow="ellipsis"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Panel>
      </Stack>
      {!isInitiallyLoading && !isFilteredEmpty && (
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
