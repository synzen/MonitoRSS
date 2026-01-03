import {
  PropsWithChildren,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { UserFeedComputedStatus } from "../features/feed/types";
import { useUpdateUserMe, useUserMe } from "../features/discordUser/hooks";

const PREFERENCE_DEBOUNCE_MS = 500;

interface ContextProps {
  setStatusFilters: (statuses: UserFeedComputedStatus[]) => void;
  statusFilters: UserFeedComputedStatus[];
}

export const UserFeedStatusFilterContext = createContext<ContextProps>({
  setStatusFilters: () => {},
  statusFilters: [],
});

export const UserFeedStatusFilterProvider = ({ children }: PropsWithChildren<{}>) => {
  const { data: userMe } = useUserMe();
  const { mutateAsync: updateUser } = useUpdateUserMe();

  const savedStatusFilters = userMe?.result?.preferences?.feedListStatusFilters?.statuses;
  const hasInitialized = useRef(false);

  const [statusFilters, setStatusFiltersState] = useState<UserFeedComputedStatus[]>([]);

  // Initialize from saved preference (only on first load)
  useEffect(() => {
    if (savedStatusFilters && savedStatusFilters.length > 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      setStatusFiltersState(savedStatusFilters as UserFeedComputedStatus[]);
    }
  }, [savedStatusFilters]);

  // Save preference when it changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentFilters = savedStatusFilters || [];
      const hasChanges =
        statusFilters.length !== currentFilters.length ||
        statusFilters.some((status, idx) => status !== currentFilters[idx]);

      if (hasChanges) {
        updateUser({
          details: {
            preferences: {
              feedListStatusFilters: {
                statuses: statusFilters,
              },
            },
          },
        });
      }
    }, PREFERENCE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [statusFilters, savedStatusFilters, updateUser]);

  const setStatusFilters = useCallback((statuses: UserFeedComputedStatus[]) => {
    setStatusFiltersState(statuses);
  }, []);

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
