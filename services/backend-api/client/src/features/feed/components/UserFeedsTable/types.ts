import { Dispatch, SetStateAction } from "react";
import { SortingState, VisibilityState } from "@tanstack/react-table";
import { UserFeedSummary } from "../../types";

export type RowData = UserFeedSummary;

export interface TablePreferences {
  sorting: SortingState;
  columnVisibility: VisibilityState;
  columnOrder: string[];
}

export interface TablePreferencesHandlers {
  setSorting: Dispatch<SetStateAction<SortingState>>;
  setColumnVisibility: Dispatch<SetStateAction<VisibilityState>>;
  setColumnOrder: Dispatch<SetStateAction<string[]>>;
}

export interface TableSearchState {
  searchInput: string;
  search: string;
  setSearchInput: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
}
