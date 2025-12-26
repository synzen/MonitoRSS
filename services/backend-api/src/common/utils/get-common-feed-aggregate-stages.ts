import { FilterQuery, PipelineStage } from "mongoose";
import { UserFeedDocument } from "../../features/user-feeds/entities";

export interface SlotWindow {
  /** Start of the window in ms (0 to refreshRateMs - 1) */
  windowStartMs: number;
  /** End of the window in ms (may exceed refreshRateMs if wrapping) */
  windowEndMs: number;
  /** True if window crosses the interval boundary */
  wrapsAroundInterval: boolean;
  /** The refresh interval in ms */
  refreshRateMs: number;
}

/**
 * Builds a MongoDB filter for the slot window query.
 *
 * The slot window is a 60-second range within the refresh interval.
 * We query feeds whose slotOffsetMs falls within this window.
 *
 * Edge case: When the window crosses the interval boundary (wraparound),
 * we need to query two ranges - the end of the current cycle AND the
 * start of the next cycle.
 *
 * Example wraparound for 20-minute (1,200,000ms) interval:
 * - Current position: 1,185,000ms (19:45 into cycle)
 * - Window end: 1,245,000ms (would be 20:45, but interval ends at 20:00)
 * - We query: [1,185,000 - 1,199,999] OR [0 - 44,999]
 *
 * We also include feeds without slotOffsetMs (legacy feeds during migration).
 */
function buildSlotWindowFilter(slotWindow: SlotWindow): FilterQuery<unknown> {
  // Always include legacy feeds that don't have slotOffsetMs yet
  const legacyFeedFilter = { slotOffsetMs: { $exists: false } };

  if (slotWindow.wrapsAroundInterval) {
    // Window crosses interval boundary - query both ends
    const wrappedEndMs = slotWindow.windowEndMs - slotWindow.refreshRateMs;

    return {
      $or: [
        legacyFeedFilter,
        { slotOffsetMs: { $gte: slotWindow.windowStartMs } }, // End of interval
        { slotOffsetMs: { $lt: wrappedEndMs } }, // Start of interval
      ],
    };
  } else {
    // Normal case - window within interval
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
  /**
   * When provided, filters feeds to only those whose slotOffsetMs falls
   * within the current time window. This enables staggered fetching.
   */
  slotWindow?: SlotWindow;
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

    // Filter by slot window for staggered fetching
    if (slotWindow) {
      const slotFilter = buildSlotWindowFilter(slotWindow);
      pipelineStages.push({ $match: slotFilter });
    }
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
