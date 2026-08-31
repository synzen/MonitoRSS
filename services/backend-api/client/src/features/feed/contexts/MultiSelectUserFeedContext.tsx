import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { RowSelectionState } from "@tanstack/react-table";
import { UserFeedSummary } from "../types/UserFeedSummary";
import type { BulkFeedFilter } from "../types/BulkFeedFilter";

type ContextProps = {
  /** The selected feeds, including rows selected on earlier pages. */
  selectedFeeds: UserFeedSummary[];
  /** The selected feed ids, including rows selected on earlier pages. */
  selectedFeedIds: string[];
  /** The selection identity (feed id -> selected), owned here as the source of truth. */
  rowSelection: RowSelectionState;
  setRowSelection: (
    updater:
      | RowSelectionState
      | ((prev: RowSelectionState) => RowSelectionState),
  ) => void;
  /** The table publishes its currently-loaded feeds to retain selected row details. */
  setLoadedFeeds: (feeds: UserFeedSummary[]) => void;
  clearSelection: () => void;
  selectAllMatching: boolean;
  setSelectAllMatching: (value: boolean) => void;
  matchingTotal: number;
  setMatchingTotal: (total: number) => void;
  matchingFilters: BulkFeedFilter | null;
  setMatchingFilters: (filters: BulkFeedFilter | null) => void;
};

export const MultiSelectUserFeedContext = createContext<ContextProps>({
  selectedFeeds: [],
  selectedFeedIds: [],
  rowSelection: {},
  setRowSelection: () => {},
  setLoadedFeeds: () => {},
  clearSelection: () => {},
  selectAllMatching: false,
  setSelectAllMatching: () => {},
  matchingTotal: 0,
  setMatchingTotal: () => {},
  matchingFilters: null,
  setMatchingFilters: () => {},
});

export const MultiSelectUserFeedProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [loadedFeeds, setLoadedFeeds] = useState<UserFeedSummary[]>([]);
  const [selectedFeedDetails, setSelectedFeedDetails] = useState<
    Record<string, UserFeedSummary>
  >({});
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [matchingTotal, setMatchingTotal] = useState(0);
  const [matchingFilters, setMatchingFilters] = useState<BulkFeedFilter | null>(
    null,
  );

  const clearSelection = useCallback(() => {
    setRowSelection({});
    setSelectedFeedDetails({});
    setSelectAllMatching(false);
    setMatchingFilters(null);
  }, []);

  useEffect(() => {
    setSelectedFeedDetails((previous) => {
      const next = Object.fromEntries(
        Object.entries(previous).filter(([id]) => rowSelection[id]),
      ) as Record<string, UserFeedSummary>;

      for (const feed of loadedFeeds) {
        if (rowSelection[feed.id]) next[feed.id] = feed;
      }

      return next;
    });
  }, [loadedFeeds, rowSelection]);

  const selectedFeedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );

  const selectedFeeds = useMemo(
    () =>
      selectedFeedIds.flatMap((id) =>
        selectedFeedDetails[id] ? [selectedFeedDetails[id]] : [],
      ),
    [selectedFeedDetails, selectedFeedIds],
  );

  const value: ContextProps = useMemo(
    () => ({
      selectedFeeds,
      selectedFeedIds,
      rowSelection,
      setRowSelection,
      setLoadedFeeds,
      clearSelection,
      selectAllMatching,
      setSelectAllMatching,
      matchingTotal,
      setMatchingTotal,
      matchingFilters,
      setMatchingFilters,
    }),
    [
      selectedFeeds,
      selectedFeedIds,
      rowSelection,
      clearSelection,
      selectAllMatching,
      matchingTotal,
      matchingFilters,
    ],
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
