import {
  PropsWithChildren,
  createContext,
  useCallback,
  useMemo,
  useState,
} from "react";
import { UserFeedComputedStatus } from "../types";

interface ContextProps {
  setStatusFilters: (statuses: UserFeedComputedStatus[]) => void;
  statusFilters: UserFeedComputedStatus[];
}

export const UserFeedStatusFilterContext = createContext<ContextProps>({
  setStatusFilters: () => {},
  statusFilters: [],
});

export const UserFeedStatusFilterProvider = ({
  children,
}: PropsWithChildren<{}>) => {
  const [statusFilters, setStatusFiltersState] = useState<
    UserFeedComputedStatus[]
  >([]);

  const setStatusFilters = useCallback((statuses: UserFeedComputedStatus[]) => {
    setStatusFiltersState(statuses);
  }, []);

  const value = useMemo(
    () => ({
      statusFilters,
      setStatusFilters,
    }),
    [statusFilters, setStatusFilters],
  );

  return (
    <UserFeedStatusFilterContext.Provider value={value}>
      {children}
    </UserFeedStatusFilterContext.Provider>
  );
};
