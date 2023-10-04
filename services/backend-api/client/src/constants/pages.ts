import { FeedConnectionType } from "../types";

const getConnectionPathByType = (type: FeedConnectionType) => {
  switch (type) {
    case FeedConnectionType.DiscordChannel:
      return "/discord-channel-connections";
    case FeedConnectionType.DiscordWebhook:
      return "/discord-webhook-connections";
    default:
      return "";
  }
};

export const pages = {
  alerting: () => "/alerting",
  userSettings: () => "/settings",
  userFeeds: () => "/feeds",
  userFeed: (feedId: string) => `/feeds/${feedId}`,
  userFeedConnection: (data: {
    feedId: string;
    connectionType: FeedConnectionType;
    connectionId: string;
  }) => `/feeds/${data.feedId}${getConnectionPathByType(data.connectionType)}/${data.connectionId}`,
  userFeedsFaq: () => "/feeds/faq",
};
