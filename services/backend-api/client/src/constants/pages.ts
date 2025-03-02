import { FeedConnectionType } from "../types";
import { UserFeedConnectionTabSearchParam } from "./userFeedConnectionTabSearchParam";
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
  checkout: (priceId: string) => `/paddle-checkout/${priceId}`,
  addFeeds: () => "/add-feeds",
  userSettings: () => "/settings",
  userFeeds: () => "/feeds",
  notFound: () => "/not-found",
  testPaddle: () => "/test-paddle",
  userFeed: (feedId: string, opts?: { tab?: UserFeedTabSearchParam }) =>
    `/feeds/${feedId}${opts?.tab ? opts.tab : ""}`,
  userFeedConnection: (
    data: {
      feedId: string;
      connectionType: FeedConnectionType;
      connectionId: string;
    },
    opts?: { tab?: UserFeedConnectionTabSearchParam }
  ) =>
    `/feeds/${data.feedId}${getConnectionPathByType(data.connectionType)}/${data.connectionId}${
      opts?.tab ? opts.tab : ""
    }`,
  userFeedsFaq: () => "/feeds/faq",
  loginReddit: () => "/api/v1/reddit/login",
};
