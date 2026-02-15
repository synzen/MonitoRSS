import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { UserFeedSummary } from "../features/feed/types/UserFeedSummary";

type ContextProps = {
  selectedFeeds: UserFeedSummary[];
  setSelectedFeeds: (feeds: UserFeedSummary[]) => void;
  clearSelection: () => void;
};

export const MultiSelectUserFeedContext = createContext<ContextProps>({
  selectedFeeds: [],
  setSelectedFeeds: () => {},
  clearSelection: () => {},
});

export const MultiSelectUserFeedProvider = ({ children }: { children: ReactNode }) => {
  const [selectedFeeds, setSelectedFeeds] = useState<UserFeedSummary[]>([]);

  const clearSelection = useCallback(() => {
    setSelectedFeeds([]);
  }, []);

  const value: ContextProps = useMemo(
    () => ({
      selectedFeeds,
      setSelectedFeeds,
      clearSelection,
    }),
    [selectedFeeds, setSelectedFeeds, clearSelection],
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
