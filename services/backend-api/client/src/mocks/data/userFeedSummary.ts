import {
  UserFeedComputedStatus,
  UserFeedDisabledCode,
  UserFeedHealthStatus,
  UserFeedSummary,
} from "../../features/feed/types";
import mockUserFeeds from "./userFeeds";

const mockUserFeedSummary: UserFeedSummary[] = [
  {
    id: mockUserFeeds[0].id, // empty-feed
    title: "[Test] Empty Feed (No Articles)",
    url: "https://www.empty-feed-test.com/rss",
    createdAt: new Date().toISOString(),
    computedStatus: UserFeedComputedStatus.Ok,
    healthStatus: UserFeedHealthStatus.Ok,
    ownedByUser: true,
    connectionCount: 0,
  },
  {
    id: mockUserFeeds[1].id,
    title: "New York Times",
    url: "https://www.feed1.com",
    createdAt: new Date().toISOString(),
    computedStatus: UserFeedComputedStatus.RequiresAttention,
    healthStatus: UserFeedHealthStatus.Ok,
    ownedByUser: true,
    connectionCount: 1,
  },
  {
    id: mockUserFeeds[2].id,
    title: "Yahoo News",
    url: "https://www.feed2.com",
    createdAt: new Date().toISOString(),
    healthStatus: UserFeedHealthStatus.Failed,
    disabledCode: UserFeedDisabledCode.Manual,
    computedStatus: UserFeedComputedStatus.Ok,
    ownedByUser: false,
    connectionCount: 2,
  },
  {
    id: mockUserFeeds[3].id,
    title: "CNN",
    url: "https://www.feed3.com",
    createdAt: new Date().toISOString(),
    healthStatus: UserFeedHealthStatus.Failing,
    disabledCode: undefined,
    computedStatus: UserFeedComputedStatus.Retrying,
    ownedByUser: true,
    connectionCount: 1,
  },
];

for (let i = 0; i < 100; i += 1) {
  mockUserFeedSummary.push({
    id: `${i + 4}`,
    title: `Feed ${i + 4}`,
    url: `https://www.feed${i + 4}.com`,
    createdAt: new Date().toISOString(),
    healthStatus: UserFeedHealthStatus.Ok,
    disabledCode: undefined,
    computedStatus: UserFeedComputedStatus.Ok,
    ownedByUser: true,
    connectionCount: 1,
  });
}

export default mockUserFeedSummary;
