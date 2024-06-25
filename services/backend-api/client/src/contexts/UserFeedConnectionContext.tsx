import { ReactNode, createContext, useContext, useMemo } from "react";
import { Spinner } from "@chakra-ui/react";
import { UserFeed } from "../features/feed/types";
import { FeedConnection, FeedDiscordChannelConnection } from "../types";
import { DiscordFormatOptions } from "../types/DiscordFormatOptions";
import { useUserFeed } from "../features/feed/hooks";

type ContextProps =
  | {
      userFeed: UserFeed;
      connection: FeedConnection;
      articleFormatOptions: DiscordFormatOptions;
    }
  | undefined;

const defaultFormat: DiscordFormatOptions = {
  externalProperties: [],
  formatTables: false,
  stripImages: false,
};

export const UserFeedConnectionContext = createContext<ContextProps>(undefined);

export const UserFeedConnectionProvider = ({
  feedId,
  connectionId,
  articleFormatOptions,
  children,
}: {
  feedId?: string;
  connectionId?: string;
  articleFormatOptions?: Partial<DiscordFormatOptions>;
  children: ReactNode;
}) => {
  const { feed, status } = useUserFeed({ feedId });
  const connection = feed?.connections.find(
    (c) => c.id === connectionId
  ) as FeedDiscordChannelConnection;

  if (status === "loading" || !feed || !connection) {
    return <Spinner />;
  }

  const value: ContextProps = useMemo(
    () => ({
      userFeed: feed,
      connection,
      articleFormatOptions: {
        formatTables: connection.details.formatter.formatTables ?? false,
        stripImages: connection.details.formatter.stripImages ?? false,
        dateFormat: feed?.formatOptions?.dateFormat || defaultFormat.dateFormat,
        dateTimezone: feed?.formatOptions?.dateTimezone || defaultFormat.dateTimezone,
        externalProperties: feed?.externalProperties || defaultFormat.externalProperties,
        disableImageLinkPreviews: connection.details.formatter.disableImageLinkPreviews ?? false,
        ignoreNewLines: connection.details.formatter.ignoreNewLines ?? false,
        customPlaceholders: connection.customPlaceholders,
        ...articleFormatOptions,
      },
    }),
    [feed]
  );

  return (
    <UserFeedConnectionContext.Provider value={value}>
      {children}
    </UserFeedConnectionContext.Provider>
  );
};

export const useUserFeedConnectionContext = <T extends FeedConnection>() => {
  const contextData = useContext(UserFeedConnectionContext);

  if (!contextData) {
    throw new Error(`No user feed connection found in context`);
  }

  return {
    ...contextData,
    connection: contextData.connection as T,
  };
};
