import { ReactNode, createContext, useContext, useMemo } from "react";
import { Spinner } from "@chakra-ui/react";
import { UserFeed, useUserFeed } from "../features/feed";

type ContextProps =
  | {
      userFeed: UserFeed;
    }
  | undefined;

export const UserFeedContext = createContext<ContextProps>(undefined);

export const UserFeedProvider = ({
  feedId,
  children,
}: {
  feedId?: string;
  children: ReactNode;
}) => {
  const { feed, status } = useUserFeed({ feedId });

  if (status === "loading" || !feed) {
    return <Spinner />;
  }

  const value: ContextProps = useMemo(
    () => ({
      userFeed: feed,
    }),
    [feed]
  );

  return <UserFeedContext.Provider value={value}>{children}</UserFeedContext.Provider>;
};

export const useUserFeedContext = () => {
  const contextData = useContext(UserFeedContext);

  if (!contextData) {
    throw new Error(`No user feed found in context!`);
  }

  return contextData;
};
