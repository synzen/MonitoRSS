import { FilterQuery, PipelineStage } from "mongoose";
import { UserFeedDocument } from "../../features/user-feeds/entities";

export function getCommonFeedAggregateStages({
  refreshRateSeconds,
  url,
  feedRequestLookupKey,
  withLookupKeys,
}: {
  refreshRateSeconds: number;
  url?: string;
  feedRequestLookupKey?: string;
  withLookupKeys?: boolean;
}) {
  const query: FilterQuery<UserFeedDocument> = {
    ...(url ? { url } : {}),
    disabledCode: {
      $exists: false,
    },
    ...(feedRequestLookupKey
      ? {
          feedRequestLookupKey,
        }
      : {}),
    feedRequestLookupKey: {
      $exists: withLookupKeys || false,
    },
    $or: [
      {
        "connections.discordChannels.0": {
          $exists: true,
        },
        "connections.discordChannels": {
          $elemMatch: {
            disabledCode: {
              $exists: false,
            },
          },
        },
      },
      {
        "connections.discordWebhooks.0": {
          $exists: true,
        },
        "connections.discordWebhooks": {
          $elemMatch: {
            disabledCode: {
              $exists: false,
            },
          },
        },
      },
    ],
  };

  const pipelineStages: PipelineStage[] = [
    {
      $match: query,
    },
    {
      $addFields: {
        useRefreshRate: {
          $ifNull: ["$userRefreshRateSeconds", "$refreshRateSeconds"],
        },
      },
    },
    {
      $match: {
        useRefreshRate: refreshRateSeconds,
      },
    },
  ];

  return pipelineStages;
}
