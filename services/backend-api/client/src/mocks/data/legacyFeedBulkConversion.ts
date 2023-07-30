import { GetServerLegacyFeedBulkConversionOutput } from "../../features/feed";

export const legacyFeedBulkConversion: GetServerLegacyFeedBulkConversionOutput = {
  status: "NOT_STARTED",
  counts: {
    completed: Math.round(Math.random() * 10),
    failed: Math.round(Math.random() * 10),
    inProgress: Math.round(Math.random() * 10),
    notStarted: Math.round(Math.random() * 10),
  },
  failedFeeds: [
    {
      _id: "1",
      title: "title1",
      url: "url1",
      failReasonPublic: "Internal server error",
    },
    {
      _id: "2",
      title: "title2",
      url: "url2",
    },
    {
      _id: "3",
      title: "title3",
      url: "url3",
      failReasonPublic: "Already converted",
    },
  ],
};
