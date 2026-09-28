import type { PipelineStage, FilterQuery } from "mongoose";
import type { SlotWindow } from "../types/slot-window.types";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
  UserFeedScheduleMode,
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
  includeAnyLookupKey,
  slotWindow,
  includeRecoveryFeeds,
  scheduledOnly,
}: {
  refreshRateSeconds?: number;
  url?: string;
  feedRequestLookupKey?: string;
  withLookupKeys?: boolean;
  // Omits the lookup-key restriction entirely: the query returns feeds with
  // and without lookup keys. The clock-scheduling query needs this because it
  // evaluates both kinds of scheduled feed in one pass.
  includeAnyLookupKey?: boolean;
  slotWindow?: SlotWindow;
  // Opts scheduling queries into bulk-recovery feeds (disabled with
  // FAILED_REQUESTS while health is FAILING). Delivery queries never pass this,
  // so recovering feeds stay excluded from article delivery.
  includeRecoveryFeeds?: boolean;
  // Restricts the query to scheduled-mode feeds (clock scheduling, ADR-009).
  // Without it, every interval scheduling/delivery query excludes them: a
  // scheduled feed must never be fetched by an interval cycle of its retained
  // refresh rate, nor delivered to by another feed's interval fetch.
  scheduledOnly?: boolean;
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
    ...(includeAnyLookupKey
      ? {}
      : {
          feedRequestLookupKey: feedRequestLookupKey
            ? feedRequestLookupKey
            : {
                $exists: withLookupKeys || false,
              },
        }),
    // Absence of scheduleMode means interval (pre-feature documents), so the
    // interval side must exclude with $ne rather than requiring a value.
    scheduleMode: scheduledOnly
      ? UserFeedScheduleMode.Scheduled
      : { $ne: UserFeedScheduleMode.Scheduled },
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
