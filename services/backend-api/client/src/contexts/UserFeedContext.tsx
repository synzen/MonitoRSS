import { ReactElement, ReactNode, createContext, useContext, useMemo } from "react";
import { Spinner } from "@chakra-ui/react";
import { UserFeed } from "../features/feed/types";
import { FeedFormatOptions } from "../types/FeedFormatOptions";
import { useUserFeed } from "../features/feed/hooks";

type ContextProps =
  | {
      userFeed: UserFeed;
      articleFormatOptions: FeedFormatOptions;
    }
  | undefined;

const defaultFormat: FeedFormatOptions = {
  externalProperties: [],
  formatTables: false,
  stripImages: false,
};

export const UserFeedContext = createContext<ContextProps>(undefined);

export const UserFeedProvider = ({
  feedId,
  children,
  loadingComponent,
  errorComponent,
}: {
  feedId?: string;
  children: ReactNode;
  loadingComponent?: ReactElement;
  errorComponent?: ReactElement;
}) => {
  const { feed, status, error } = useUserFeed({ feedId });

  const value: Partial<ContextProps> = useMemo(
    () => ({
      userFeed: feed,
      articleFormatOptions: {
        formatTables: false,
        stripImages: false,
        dateFormat: feed?.formatOptions?.dateFormat || defaultFormat.dateFormat,
        dateTimezone: feed?.formatOptions?.dateTimezone || defaultFormat.dateTimezone,
        externalProperties: feed?.externalProperties || defaultFormat.externalProperties,
        disableImageLinkPreviews: false,
        ignoreNewLines: false,
      },
    }),
    [feed]
  );

  if (error && errorComponent) {
    return errorComponent;
  }

  if (status === "loading" || !feed) {
    return loadingComponent || <Spinner />;
  }

  return (
    <UserFeedContext.Provider value={value as ContextProps}>{children}</UserFeedContext.Provider>
  );
};

export const useUserFeedContext = () => {
  const contextData = useContext(UserFeedContext);

  if (!contextData) {
    throw new Error(`No user feed found in context`);
  }

  return contextData;
};
