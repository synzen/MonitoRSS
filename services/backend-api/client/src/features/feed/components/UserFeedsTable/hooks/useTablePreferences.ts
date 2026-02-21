import { useEffect, useRef, useState } from "react";
import { SortingState, VisibilityState } from "@tanstack/react-table";
import { useUserMe, useUpdateUserMe } from "../../../../discordUser/hooks";
import {
  DEFAULT_COLUMN_ORDER,
  DEFAULT_COLUMN_VISIBILITY,
  FIXED_COLUMNS,
  PREFERENCE_DEBOUNCE_MS,
  TOGGLEABLE_COLUMNS,
} from "../constants";
import { TablePreferences, TablePreferencesHandlers } from "../types";

export function useTablePreferences(): TablePreferences & TablePreferencesHandlers {
  const { data: userMe } = useUserMe();
  const { mutateAsync: updateUser } = useUpdateUserMe();

  const savedSortPreference = userMe?.result?.preferences?.feedListSort;
  const savedColumnVisibility = userMe?.result?.preferences?.feedListColumnVisibility;
  const savedColumnOrder = userMe?.result?.preferences?.feedListColumnOrder?.columns;

  // Initialization refs to prevent re-initialization after mount
  const hasInitializedSorting = useRef(false);
  const hasInitializedColumnVisibility = useRef(false);
  const hasInitializedColumnOrder = useRef(false);

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (savedSortPreference) {
      return [{ id: savedSortPreference.key, desc: savedSortPreference.direction === "desc" }];
    }

    return [];
  });

  // Column visibility state
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(DEFAULT_COLUMN_VISIBILITY);

  // Column order state
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (savedColumnOrder && savedColumnOrder.length > 0) {
      const isFixed = (col: string) =>
        FIXED_COLUMNS.includes(col as (typeof FIXED_COLUMNS)[number]);

      return ["select", ...savedColumnOrder.filter((col) => !isFixed(col)), "configure"];
    }

    return DEFAULT_COLUMN_ORDER;
  });

  // Initialize sorting from saved preference (only on first load)
  useEffect(() => {
    if (savedSortPreference && !hasInitializedSorting.current) {
      hasInitializedSorting.current = true;
      setSorting([{ id: savedSortPreference.key, desc: savedSortPreference.direction === "desc" }]);
    }
  }, [savedSortPreference?.key, savedSortPreference?.direction]);

  // Save sorting preference when it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newPreference = sorting[0]
        ? { key: sorting[0].id, direction: (sorting[0].desc ? "desc" : "asc") as "asc" | "desc" }
        : null;

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
    }, PREFERENCE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [sorting, savedSortPreference, updateUser]);

  // Initialize column visibility from saved preference (only on first load)
  useEffect(() => {
    if (savedColumnVisibility && !hasInitializedColumnVisibility.current) {
      hasInitializedColumnVisibility.current = true;
      setColumnVisibility({
        ...DEFAULT_COLUMN_VISIBILITY,
        ...savedColumnVisibility,
      });
    }
  }, [savedColumnVisibility]);

  // Save column visibility preference when it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const visibleCount = TOGGLEABLE_COLUMNS.filter(({ id }) => columnVisibility[id]).length;

      if (visibleCount === 0) {
        return;
      }

      const hasChanges = TOGGLEABLE_COLUMNS.some(
        ({ id }) =>
          columnVisibility[id] !== (savedColumnVisibility?.[id] ?? DEFAULT_COLUMN_VISIBILITY[id])
      );

      if (hasChanges) {
        updateUser({
          details: {
            preferences: {
              feedListColumnVisibility: {
                computedStatus: columnVisibility.computedStatus,
                url: columnVisibility.url,
                createdAt: columnVisibility.createdAt,
                refreshRateSeconds: columnVisibility.refreshRateSeconds,
                ownedByUser: columnVisibility.ownedByUser,
              },
            },
          },
        });
      }
    }, PREFERENCE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [columnVisibility, savedColumnVisibility, updateUser]);

  // Initialize column order from saved preference (only on first load)
  useEffect(() => {
    if (savedColumnOrder && savedColumnOrder.length > 0 && !hasInitializedColumnOrder.current) {
      hasInitializedColumnOrder.current = true;
      const isFixed = (col: string) =>
        FIXED_COLUMNS.includes(col as (typeof FIXED_COLUMNS)[number]);

      setColumnOrder(["select", ...savedColumnOrder.filter((col) => !isFixed(col)), "configure"]);
    }
  }, [savedColumnOrder]);

  // Save column order preference when it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const isFixed = (col: string) =>
        FIXED_COLUMNS.includes(col as (typeof FIXED_COLUMNS)[number]);
      const orderToSave = columnOrder.filter((col) => !isFixed(col));

      const currentOrder = savedColumnOrder || [];
      const hasChanges =
        orderToSave.length !== currentOrder.length ||
        orderToSave.some((col, idx) => col !== currentOrder[idx]);

      if (hasChanges && orderToSave.length > 0) {
        updateUser({
          details: {
            preferences: {
              feedListColumnOrder: {
                columns: orderToSave,
              },
            },
          },
        });
      }
    }, PREFERENCE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [columnOrder, savedColumnOrder, updateUser]);

  return {
    sorting,
    setSorting,
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
  };
}
