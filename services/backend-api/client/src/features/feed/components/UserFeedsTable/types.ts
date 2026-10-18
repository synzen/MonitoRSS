import { Dispatch, SetStateAction } from "react";
import { SortingState, ColumnVisibilityState } from "@tanstack/react-table";
import { UserFeedSummary } from "../../types";

export type RowData = UserFeedSummary;

export interface TablePreferences {
  sorting: SortingState;
  columnVisibility: ColumnVisibilityState;
  columnOrder: string[];
  isCompact: boolean;
  pageSize: number;
}

export interface TablePreferencesHandlers {
  setSorting: Dispatch<SetStateAction<SortingState>>;
  setColumnVisibility: Dispatch<SetStateAction<ColumnVisibilityState>>;
  setColumnOrder: Dispatch<SetStateAction<string[]>>;
  setIsCompact: Dispatch<SetStateAction<boolean>>;
  setPageSize: Dispatch<SetStateAction<number>>;
}

export interface TableSearchState {
  searchInput: string;
  search: string;
  setSearchInput: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
}
