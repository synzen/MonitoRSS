import {
  Box,
  Button,
  Center,
  HStack,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  OnChangeFn,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  closestCenter,
  closestCorners,
  DndContext,
  DragEndEvent,
  getFirstCollision,
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
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
  PaginationSection,
} from "./components";
import { createTableColumns } from "./columns";
import {
  DEFAULT_PAGE_SIZE,
  FEED_TABLE_FOCUS_KEY,
  PAGE_SIZE_OPTIONS,
} from "./constants";

function parsePage(value: string | null): number {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parsePageSize(value: string | null): number {
  const pageSize = Number(value);

  return PAGE_SIZE_OPTIONS.includes(
    pageSize as (typeof PAGE_SIZE_OPTIONS)[number],
  )
    ? pageSize
    : DEFAULT_PAGE_SIZE;
}

function statusFiltersFromUrl(value: string | null): UserFeedComputedStatus[] {
  const validStatuses = new Set<UserFeedComputedStatus>(
    Object.values(UserFeedComputedStatus),
  );

  return (value || "")
    .split(",")
    .filter((status): status is UserFeedComputedStatus =>
      validStatuses.has(status as UserFeedComputedStatus),
    );
}

// dnd-kit's `sortableKeyboardCoordinates` adds a width-compensation offset for
// right moves (`collisionRect.width - newRect.width`) to align right edges.
// On a table with variable-width columns (Status 60px vs URL 250px) that
// makes ArrowRight land 100px inside the target and the subsequent
// `closestCenter` picks the next column, so a 4-right/4-left round-trip ends
// one column off. For `horizontalListSortingStrategy` on `th` we want
// left-edge alignment in both directions - one press = one column.
const tableKeyboardCoordinates: import("@dnd-kit/core").KeyboardCoordinateGetter =
  (event, { context }) => {
    if (event.code !== KeyboardCode.Right && event.code !== KeyboardCode.Left) {
      return undefined;
    }

    event.preventDefault();
    if (!context.active || !context.collisionRect) return undefined;

    const filtered: never[] = [];

    for (const entry of context.droppableContainers.getEnabled()) {
      if (!entry || (entry as { disabled?: boolean }).disabled) continue;
      const rect = context.droppableRects.get(entry.id);
      if (!rect) continue;

      if (
        event.code === KeyboardCode.Right &&
        context.collisionRect.left < rect.left
      ) {
        (filtered as unknown[]).push(entry as never);
      } else if (
        event.code === KeyboardCode.Left &&
        context.collisionRect.left > rect.left
      ) {
        (filtered as unknown[]).push(entry as never);
      }
    }

    const collisions = closestCorners({
      active: context.active,
      collisionRect: context.collisionRect,
      droppableRects: context.droppableRects,
      droppableContainers: filtered as never,
      pointerCoordinates: null,
    });
    let closestId = getFirstCollision(collisions, "id");

    if (closestId === context.over?.id && collisions.length > 1) {
      closestId = collisions[1].id;
    }

    if (closestId != null) {
      const newDroppable = context.droppableContainers.get(closestId);
      const newRect = newDroppable
        ? context.droppableRects.get(newDroppable.id)
        : null;

      if (newDroppable && newRect) {
        return { x: newRect.left, y: newRect.top };
      }
    }

    return undefined;
  };

export const UserFeedsTable: React.FC = () => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: tableKeyboardCoordinates,
    }),
  );

  const { statusFilters, setStatusFilters } = useContext(
    UserFeedStatusFilterContext,
  );
  const {
    rowSelection,
    setRowSelection,
    setLoadedFeeds,
    clearSelection,
    selectAllMatching,
    setSelectAllMatching,
    setMatchingTotal,
    setMatchingFilters,
  } = useMultiSelectUserFeedContext();
  const { workspaceSlug, workspaceId } = useFeedScope();
  const isWorkspaceScope = !!workspaceSlug;
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get("page"));
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const urlSearch = searchParams.get("search") || "";

  // Preferences (sorting, column visibility, column order, row density)
  const {
    sorting,
    setSorting,
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
    isCompact,
    setIsCompact,
  } = useTablePreferences();

  const urlStatusFilters = statusFiltersFromUrl(searchParams.get("status"));
  const activeStatusFilters = searchParams.has("status")
    ? urlStatusFilters
    : statusFilters;
  const urlSort = searchParams.get("sort");

  useEffect(() => {
    if (!urlSort) return;

    const nextSorting = [
      { id: urlSort.replace(/^-/, ""), desc: urlSort.startsWith("-") },
    ];

    if (
      sorting.length !== 1 ||
      sorting[0].id !== nextSorting[0].id ||
      sorting[0].desc !== nextSorting[0].desc
    ) {
      setSorting(nextSorting);
    }
  }, [setSorting, sorting, urlSort]);

  useEffect(() => {
    if (urlSort || !sorting[0]) return;

    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set("sort", `${sorting[0].desc ? "-" : ""}${sorting[0].id}`);

      return params;
    });
  }, [setSearchParams, sorting, urlSort]);

  useEffect(() => {
    if (!searchParams.has("status")) return;

    if (
      urlStatusFilters.length !== statusFilters.length ||
      urlStatusFilters.some((status, index) => status !== statusFilters[index])
    ) {
      setStatusFilters(urlStatusFilters);
    }
  }, [searchParams, statusFilters, setStatusFilters, urlStatusFilters]);

  useEffect(() => {
    if (searchParams.has("status") || statusFilters.length === 0) return;

    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set("status", statusFilters.join(","));
      params.delete("page");

      return params;
    });
  }, [searchParams, setSearchParams, statusFilters]);

  // Data fetching
  const { data, rows, total, status, error, isFetching } = useFeedTableData({
    sorting,
    statusFilters: activeStatusFilters,
    page,
    pageSize,
    search: urlSearch,
  });

  useEffect(() => {
    setMatchingTotal(total);
  }, [total, setMatchingTotal]);

  const urlSortKey = searchParams.get("sort") || "";

  useEffect(() => {
    if (selectAllMatching) {
      setSelectAllMatching(false);
      setMatchingFilters(null);
    }

    // Changing the query should also drop any lingering page selection that no
    // longer corresponds to the filtered result set.
    if (Object.keys(rowSelection).length > 0) {
      setRowSelection({});
    }
  }, [urlSearch, activeStatusFilters.join(","), workspaceId, urlSortKey]);

  // Search state
  const {
    searchInput,
    search: tableSearch,
    setSearchInput,
    onSearchSubmit,
    onSearchClear,
  } = useTableSearch({
    onSearchChange: useCallback(() => {}, []),
  });

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

  const handleExitMatching = useCallback(() => {
    setSelectAllMatching(false);
    setMatchingFilters(null);
  }, [setSelectAllMatching, setMatchingFilters]);

  const handleSelectAllMatching = useCallback(() => {
    setSelectAllMatching(true);
    setMatchingFilters({
      search: urlSearch || undefined,
      filters: activeStatusFilters.length
        ? { computedStatuses: activeStatusFilters as unknown as string[] }
        : undefined,
      workspaceId: workspaceId || undefined,
    });
  }, [
    activeStatusFilters,
    setMatchingFilters,
    setSelectAllMatching,
    urlSearch,
    workspaceId,
  ]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const pageSelectionCheckboxRef = useRef<HTMLInputElement>(null);
  const clearSelectionButtonRef = useRef<HTMLButtonElement>(null);
  const pendingFocusTarget = useRef<
    "clear-selection" | "page-selection" | null
  >(null);

  // Columns with search highlighting; links stay in the current (workspace) scope.
  // The "Shared with Me" column is meaningless in a workspace (all feeds are
  // shared with members), so it's omitted there.
  const columns = useMemo(
    () =>
      createTableColumns(
        tableSearch,
        workspaceSlug ? { workspaceSlug } : undefined,
        {
          excludeSharedWithMe: isWorkspaceScope,
          isCompact,
          selectAllMatching,
          onExitMatching: handleExitMatching,
          headerCheckboxRef: pageSelectionCheckboxRef,
        },
      ),
    [
      tableSearch,
      workspaceSlug,
      isWorkspaceScope,
      isCompact,
      selectAllMatching,
      handleExitMatching,
      pageSelectionCheckboxRef,
    ],
  );

  const hasActiveFilters = !!urlSearch || activeStatusFilters.length > 0;

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

      const isFixed = (id: string | number) =>
        id === "select" || id === "configure";

      if (
        over &&
        active.id !== over.id &&
        !isFixed(active.id) &&
        !isFixed(over.id)
      ) {
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
    data: rows,
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
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const sort = next[0] ? `${next[0].desc ? "-" : ""}${next[0].id}` : "";

      setSorting(next);
      setSearchParams((previous) => {
        const params = new URLSearchParams(previous);
        if (sort) params.set("sort", sort);
        else params.delete("sort");
        params.delete("page");

        return params;
      });
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
  });

  const { getHeaderGroups, getRowModel } = tableInstance;

  // Publish the loaded feeds so the context can derive the selected feed objects
  // (selected ids ∩ loaded feeds). When a bulk delete drops feeds from the list,
  // they fall out of the derived selection on the next render with no pruning.
  useEffect(() => {
    setLoadedFeeds(rows);
  }, [rows, setLoadedFeeds]);

  const isAllPageSelected =
    rows.length > 0 && rows.every((r) => rowSelection[r.id]);

  useEffect(() => {
    const feedId = sessionStorage.getItem(FEED_TABLE_FOCUS_KEY);
    const row = feedId ? rowRefs.current.get(feedId) : undefined;

    if (row) {
      sessionStorage.removeItem(FEED_TABLE_FOCUS_KEY);
      row.focus();
    }
  }, [rows]);

  // Status filter handler
  const onStatusSelect = useCallback(
    (statuses: UserFeedComputedStatus[]) => {
      setStatusFilters(statuses);
      setSearchParams((previous) => {
        const params = new URLSearchParams(previous);
        if (statuses.length) params.set("status", statuses.join(","));
        else params.delete("status");
        params.delete("page");

        return params;
      });
    },
    [setStatusFilters, setSearchParams],
  );

  const isInitiallyLoading = status === "loading" && !data;

  const isFilteredEmpty =
    !isInitiallyLoading && rows.length === 0 && hasActiveFilters;

  const shouldOfferSelectAllMatching =
    !isInitiallyLoading &&
    !isFilteredEmpty &&
    !selectAllMatching &&
    isAllPageSelected &&
    total > rows.length;
  const selectionAnnouncement = selectAllMatching
    ? `Selection now includes all ${total.toLocaleString()} matching feeds. Focus moved to Clear selection.`
    : shouldOfferSelectAllMatching
      ? `All ${rows.length.toLocaleString()} feeds on this page selected. Press Tab through the table header controls to reach Select all ${total.toLocaleString()} matching feeds.`
      : "";

  const handleSelectAllMatchingWithFocus = useCallback(() => {
    pendingFocusTarget.current = "clear-selection";
    handleSelectAllMatching();
  }, [handleSelectAllMatching]);

  const handleClearSelectionWithFocus = useCallback(() => {
    pendingFocusTarget.current = "page-selection";
    clearSelection();
  }, [clearSelection]);

  useEffect(() => {
    if (pendingFocusTarget.current === "clear-selection" && selectAllMatching) {
      clearSelectionButtonRef.current?.focus();
      pendingFocusTarget.current = null;
    } else if (
      pendingFocusTarget.current === "page-selection" &&
      !selectAllMatching
    ) {
      pageSelectionCheckboxRef.current?.focus();
      pendingFocusTarget.current = null;
    }
  }, [selectAllMatching]);

  const [tableAnnouncement, setTableAnnouncement] = useState("");
  const pendingAnnouncement = useRef(true);

  useEffect(() => {
    pendingAnnouncement.current = true;
  }, [urlSearch, activeStatusFilters, page, pageSize, sorting]);

  useEffect(() => {
    if (isInitiallyLoading || isFetching) return;

    if (!pendingAnnouncement.current) return;
    pendingAnnouncement.current = false;

    if (isFilteredEmpty) {
      setTableAnnouncement("No feeds match current filters");
    } else if (hasActiveFilters) {
      setTableAnnouncement(`Showing ${rows.length} of ${total} feeds`);
    } else {
      setTableAnnouncement(`Showing ${rows.length} of ${total} feeds`);
    }
  }, [
    isInitiallyLoading,
    isFetching,
    isFilteredEmpty,
    hasActiveFilters,
    rows.length,
    total,
  ]);

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    if (!isFetching && page > pageCount) {
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          if (pageCount === 1) params.delete("page");
          else params.set("page", String(pageCount));

          return params;
        },
        { replace: true },
      );
    }
  }, [isFetching, page, pageSize, setSearchParams, total]);

  const handleClearAllFilters = useCallback(() => {
    setSearchInput("");
    setStatusFilters([]);
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.delete("search");
      params.delete("status");
      params.delete("page");

      return params;
    });
    searchInputRef.current?.focus();
  }, [setSearchInput, setSearchParams, setStatusFilters]);

  if (status === "error") {
    return <Alert status="error" title={error?.message} />;
  }

  return (
    <Stack gap={4}>
      <Box srOnly aria-live="polite">
        <Text>{tableAnnouncement}</Text>
        <Text>{selectionAnnouncement}</Text>
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
          statusFilters={activeStatusFilters}
          onStatusSelect={onStatusSelect}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          isCompact={isCompact}
          onCompactChange={setIsCompact}
          excludeSharedWithMe={isWorkspaceScope}
        />
      )}
      {!isInitiallyLoading && hasActiveFilters && (
        <ActiveFilterChips
          search={urlSearch}
          onSearchClear={onSearchClear}
          statusFilters={activeStatusFilters}
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
      {!isInitiallyLoading && !isFilteredEmpty && (
        <PaginationSection
          page={page}
          pageSize={pageSize}
          totalCount={total}
          isFetching={isFetching}
          ariaLabel="Feed table pagination (top)"
          marginBottom={0}
          onPageChange={(nextPage) => {
            setSearchParams((previous) => {
              const params = new URLSearchParams(previous);
              if (nextPage <= 1) params.delete("page");
              else params.set("page", String(nextPage));

              return params;
            });
          }}
          onPageSizeChange={(nextPageSize) => {
            setSearchParams((previous) => {
              const params = new URLSearchParams(previous);
              params.set("pageSize", String(nextPageSize));
              params.delete("page");

              return params;
            });
          }}
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
                    modifiers={[restrictToHorizontalAxis]}
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
              {(shouldOfferSelectAllMatching || selectAllMatching) && (
                <Table.Row bg="bg.muted">
                  <Table.Cell
                    colSpan={getHeaderGroups()[0]?.headers.length ?? 1}
                    paddingY={isCompact ? 1 : 2}
                    paddingX={isCompact ? 3 : "24px"}
                  >
                    <HStack justify="space-between" flexWrap="wrap" gap={2}>
                      {selectAllMatching ? (
                        <>
                          <Text fontSize="sm" fontWeight="medium">
                            All {total.toLocaleString()} matching feeds
                            selected.
                          </Text>
                          <Button
                            ref={clearSelectionButtonRef}
                            size="sm"
                            variant="ghost"
                            onClick={handleClearSelectionWithFocus}
                          >
                            Clear selection
                          </Button>
                        </>
                      ) : (
                        <>
                          <Text fontSize="sm">
                            All {rows.length.toLocaleString()} feeds on this
                            page selected.
                          </Text>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleSelectAllMatchingWithFocus}
                          >
                            Select all {total.toLocaleString()} matching feeds
                          </Button>
                        </>
                      )}
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Header>
            <Table.Body>
              {getRowModel().rows.map((row) => (
                <Table.Row
                  key={row.id}
                  tabIndex={-1}
                  ref={(element) => {
                    if (element) rowRefs.current.set(row.id, element);
                    else rowRefs.current.delete(row.id);
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isCompactUrlCell =
                      isCompact && cell.column.id === "url";

                    return (
                      <Table.Cell
                        paddingY={isCompact ? 1 : 2}
                        paddingX={isCompact ? 3 : "24px"}
                        key={cell.id}
                        maxWidth={isCompactUrlCell ? undefined : "250px"}
                        overflow={isCompactUrlCell ? undefined : "hidden"}
                        textOverflow={isCompactUrlCell ? undefined : "ellipsis"}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </Table.Cell>
                    );
                  })}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Panel>
      </Stack>
      {!isInitiallyLoading && !isFilteredEmpty && (
        <PaginationSection
          page={page}
          pageSize={pageSize}
          totalCount={total}
          isFetching={isFetching}
          ariaLabel="Feed table pagination (bottom)"
          onPageChange={(nextPage) => {
            setSearchParams((previous) => {
              const params = new URLSearchParams(previous);
              if (nextPage <= 1) params.delete("page");
              else params.set("page", String(nextPage));

              return params;
            });
          }}
          onPageSizeChange={(nextPageSize) => {
            setSearchParams((previous) => {
              const params = new URLSearchParams(previous);
              params.set("pageSize", String(nextPageSize));
              params.delete("page");

              return params;
            });
          }}
        />
      )}
    </Stack>
  );
};
