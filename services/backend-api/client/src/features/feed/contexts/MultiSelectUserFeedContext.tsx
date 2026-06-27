import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { RowSelectionState } from "@tanstack/react-table";
import { UserFeedSummary } from "../types/UserFeedSummary";

type ContextProps = {
  /**
   * The selected feeds, as objects. Derived from the selected ids intersected
   * with the feeds currently loaded in the table, so a feed that leaves the list
   * (e.g. after a bulk delete) drops out of the selection automatically — there
   * is nothing to manually prune and no window where the selection references
   * rows that no longer exist.
   */
  selectedFeeds: UserFeedSummary[];
  /** The selection identity (feed id -> selected), owned here as the source of truth. */
  rowSelection: RowSelectionState;
  setRowSelection: (
    updater: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState),
  ) => void;
  /** The table publishes its currently-loaded feeds so selectedFeeds can be derived. */
  setLoadedFeeds: (feeds: UserFeedSummary[]) => void;
  clearSelection: () => void;
};

export const MultiSelectUserFeedContext = createContext<ContextProps>({
  selectedFeeds: [],
  rowSelection: {},
  setRowSelection: () => {},
  setLoadedFeeds: () => {},
  clearSelection: () => {},
});

export const MultiSelectUserFeedProvider = ({ children }: { children: ReactNode }) => {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [loadedFeeds, setLoadedFeeds] = useState<UserFeedSummary[]>([]);

  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, []);

  // Single source of truth (rowSelection ids) intersected with live data. Both
  // inputs are independent, so a toggle never has to read the loaded data and a
  // data refetch never has to rewrite the selection.
  const selectedFeeds = useMemo(
    () => loadedFeeds.filter((feed) => rowSelection[feed.id]),
    [loadedFeeds, rowSelection],
  );

  const value: ContextProps = useMemo(
    () => ({
      selectedFeeds,
      rowSelection,
      setRowSelection,
      setLoadedFeeds,
      clearSelection,
    }),
    [selectedFeeds, rowSelection, clearSelection],
  );

  return (
    <MultiSelectUserFeedContext.Provider value={value}>
      {children}
    </MultiSelectUserFeedContext.Provider>
  );
};

export const useMultiSelectUserFeedContext = () => {
  const contextData = useContext(MultiSelectUserFeedContext);

  return contextData;
};
