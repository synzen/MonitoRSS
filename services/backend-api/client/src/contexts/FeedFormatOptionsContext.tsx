import { ReactNode, createContext, useContext, useMemo } from "react";
import { FeedConnection } from "../types";
import { useUserFeed } from "../features/feed/hooks/useUserFeed";
import { FeedFormatOptions } from "../types/FeedFormatOptions";

type ContextProps = {
  format: FeedFormatOptions;
  connection?: FeedConnection;
};

const defaultFormat: ContextProps = {
  format: {
    externalProperties: [],
    formatTables: false,
    stripImages: false,
  },
};

export const FeedFormatOptionsContext = createContext<ContextProps>(defaultFormat);

export const FeedFormatOptionsProvider = ({
  feedId,
  children,
}: {
  feedId?: string;
  children: ReactNode;
}) => {
  const { feed } = useUserFeed({ feedId });

  const value: ContextProps = useMemo(
    () => ({
      format: {
        formatTables: false,
        stripImages: false,
        dateFormat: feed?.formatOptions?.dateFormat || defaultFormat.format.dateFormat,
        dateTimezone: feed?.formatOptions?.dateTimezone || defaultFormat.format.dateTimezone,
        externalProperties: feed?.externalProperties || defaultFormat.format.externalProperties,
        disableImageLinkPreviews: false,
        ignoreNewLines: false,
      },
    }),
    [
      feed?.formatOptions?.dateFormat,
      feed?.formatOptions?.dateTimezone,
      JSON.stringify(feed?.externalProperties),
    ],
  );

  return (
    <FeedFormatOptionsContext.Provider value={value}>{children}</FeedFormatOptionsContext.Provider>
  );
};

export const useFeedFormatOptionsContext = () => {
  const contextData = useContext(FeedFormatOptionsContext);

  return contextData;
};
