import type { PipelineStage, FilterQuery } from "mongoose";
import type { SlotWindow } from "../types/slot-window.types";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../../repositories/shared/enums";

function buildSlotWindowFilter(slotWindow: SlotWindow): FilterQuery<unknown> {
  if (slotWindow.wrapsAroundInterval) {
    const wrappedEndMs = slotWindow.windowEndMs - slotWindow.refreshRateMs;

    return {
      $or: [
        { slotOffsetMs: { $gte: slotWindow.windowStartMs } },
        { slotOffsetMs: { $lt: wrappedEndMs } },
      ],
    };
  } else {
    return {
      slotOffsetMs: {
        $gte: slotWindow.windowStartMs,
        $lt: slotWindow.windowEndMs,
      },
    };
  }
}

export function getCommonFeedAggregateStages({
  refreshRateSeconds,
  url,
  feedRequestLookupKey,
  withLookupKeys,
  slotWindow,
  includeRecoveryFeeds,
}: {
  refreshRateSeconds?: number;
  url?: string;
  feedRequestLookupKey?: string;
  withLookupKeys?: boolean;
  slotWindow?: SlotWindow;
  // Opts scheduling queries into bulk-recovery feeds (disabled with
  // FAILED_REQUESTS while health is FAILING). Delivery queries never pass this,
  // so recovering feeds stay excluded from article delivery.
  includeRecoveryFeeds?: boolean;
}): PipelineStage[] {
  const disabledCodeMatch: FilterQuery<unknown> = includeRecoveryFeeds
    ? // Wrapped in $and: the query's top-level $or (connection eligibility)
      // is a separate operator key, and an object literal cannot carry two
      // $or keys — the later spread would silently drop this one.
      {
        $and: [
          {
            $or: [
              { disabledCode: { $exists: false } },
              {
                disabledCode: UserFeedDisabledCode.FailedRequests,
                healthStatus: UserFeedHealthStatus.Failing,
              },
            ],
          },
        ],
      }
    : {
        disabledCode: {
          $exists: false,
        },
      };

  const query: FilterQuery<unknown> = {
    ...(url ? { url } : {}),
    ...disabledCodeMatch,
    ...(feedRequestLookupKey
      ? {
          feedRequestLookupKey,
        }
      : {}),
    feedRequestLookupKey: feedRequestLookupKey
      ? feedRequestLookupKey
      : {
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

    if (slotWindow) {
      const slotFilter = buildSlotWindowFilter(slotWindow);
      pipelineStages.push({ $match: slotFilter });
    }
  }

  pipelineStages.push({
    $lookup: {
      from: "users",
      localField: "user.discordUserId",
      foreignField: "discordUserId",
      as: "users",
    },
  });

  // Workspace feeds resolve fetch credentials from their workspace's
  // connection, so the workspace rides alongside the creator (whose record is
  // still needed for delivery preferences and premium checks).
  pipelineStages.push({
    $lookup: {
      from: "workspaces",
      localField: "workspaceId",
      foreignField: "_id",
      as: "workspaces",
    },
  });

  return pipelineStages;
}
