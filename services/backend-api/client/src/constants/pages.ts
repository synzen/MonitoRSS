import { FeedConnectionType } from "../types";

const getConnectionPathByType = (type: FeedConnectionType) => {
  switch (type) {
    case FeedConnectionType.DiscordChannel:
      return "/discord-channel-connections";
    default:
      return "";
  }
};

export const pages = {
  alerting: () => "/alerting",
  userSettings: () => "/settings",
  userFeeds: () => "/feeds",
  notFound: () => "/not-found",
  testPaddle: () => "/test-paddle",
  userFeed: (feedId: string) => `/feeds/${feedId}`,
  userFeedConnection: (data: {
    feedId: string;
    connectionType: FeedConnectionType;
    connectionId: string;
  }) => `/feeds/${data.feedId}${getConnectionPathByType(data.connectionType)}/${data.connectionId}`,
  userFeedsFaq: () => "/feeds/faq",
};
