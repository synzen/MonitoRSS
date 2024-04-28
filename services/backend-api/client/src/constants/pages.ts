import { FeedConnectionType } from "../types";
import { UserFeedTabSearchParam } from "./userFeedTabSearchParam";

const getConnectionPathByType = (type: FeedConnectionType) => {
  switch (type) {
    case FeedConnectionType.DiscordChannel:
      return "/discord-channel-connections";
    default:
      return "";
  }
};

export const pages = {
  userSettings: () => "/settings",
  userFeeds: () => "/feeds",
  notFound: () => "/not-found",
  testPaddle: () => "/test-paddle",
  userFeed: (feedId: string, opts?: { tab?: UserFeedTabSearchParam }) =>
    `/feeds/${feedId}${opts?.tab ? opts.tab : ""}`,
  userFeedConnection: (data: {
    feedId: string;
    connectionType: FeedConnectionType;
    connectionId: string;
  }) => `/feeds/${data.feedId}${getConnectionPathByType(data.connectionType)}/${data.connectionId}`,
  userFeedsFaq: () => "/feeds/faq",
};
