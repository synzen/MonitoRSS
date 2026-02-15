import type { PipelineStage, FilterQuery } from "mongoose";
import type { SlotWindow } from "../types/slot-window.types";

function buildSlotWindowFilter(slotWindow: SlotWindow): FilterQuery<unknown> {
  const legacyFeedFilter = { slotOffsetMs: { $exists: false } };

  if (slotWindow.wrapsAroundInterval) {
    const wrappedEndMs = slotWindow.windowEndMs - slotWindow.refreshRateMs;

    return {
      $or: [
        legacyFeedFilter,
        { slotOffsetMs: { $gte: slotWindow.windowStartMs } },
        { slotOffsetMs: { $lt: wrappedEndMs } },
      ],
    };
  } else {
    return {
      $or: [
        legacyFeedFilter,
        {
          slotOffsetMs: {
            $gte: slotWindow.windowStartMs,
            $lt: slotWindow.windowEndMs,
          },
        },
      ],
    };
  }
}

export function getCommonFeedAggregateStages({
  refreshRateSeconds,
  url,
  feedRequestLookupKey,
  withLookupKeys,
  slotWindow,
}: {
  refreshRateSeconds?: number;
  url?: string;
  feedRequestLookupKey?: string;
  withLookupKeys?: boolean;
  slotWindow?: SlotWindow;
}): PipelineStage[] {
  const query: FilterQuery<unknown> = {
    ...(url ? { url } : {}),
    disabledCode: {
      $exists: false,
    },
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

  return pipelineStages;
}
