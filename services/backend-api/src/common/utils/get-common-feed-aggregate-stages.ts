import { FilterQuery, PipelineStage } from "mongoose";
import { UserFeedDocument } from "../../features/user-feeds/entities";

export function getCommonFeedAggregateStages({
  refreshRateSeconds,
  url,
  feedRequestLookupKey,
  withLookupKeys,
}: {
  refreshRateSeconds?: number;
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
  ];

  if (refreshRateSeconds) {
    pipelineStages.push({
      $match: {
        $or: [
          {
            userRefreshRateSeconds: null,
            refreshRateSeconds: refreshRateSeconds,
          },
          {
            userRefreshRateSeconds: refreshRateSeconds,
          },
        ],
      },
    });
  }

  pipelineStages.push({
    // For their preferences when for user feed events
    $lookup: {
      from: "users",
      localField: "user.discordUserId",
      foreignField: "discordUserId",
      as: "users",
    },
  });

  return pipelineStages;
}
