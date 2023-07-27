import { PropsWithChildren, createContext, useMemo, useState } from "react";
import { UserFeedComputedStatus } from "../features/feed/types";

interface ContextProps {
  setStatusFilters: (statuses: UserFeedComputedStatus[]) => void;
  statusFilters: UserFeedComputedStatus[];
}

export const UserFeedStatusFilterContext = createContext<ContextProps>({
  setStatusFilters: () => {},
  statusFilters: [],
});

export const UserFeedStatusFilterProvider = ({ children }: PropsWithChildren<{}>) => {
  const [statusFilters, setStatusFilters] = useState<UserFeedComputedStatus[]>([]);

  const value = useMemo(
    () => ({
      statusFilters,
      setStatusFilters,
    }),
    [statusFilters, setStatusFilters]
  );

  return (
    <UserFeedStatusFilterContext.Provider value={value}>
      {children}
    </UserFeedStatusFilterContext.Provider>
  );
};
