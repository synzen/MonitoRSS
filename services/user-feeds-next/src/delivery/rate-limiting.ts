import type { DeliveryRecordStore } from "../stores/interfaces/delivery-record-store";
import type { MediumRateLimit } from "./types";

export async function getUnderLimitCheck(
  deliveryRecordStore: DeliveryRecordStore,
  filter: { feedId?: string; mediumId?: string },
  limits: MediumRateLimit[]
): Promise<{ underLimit: boolean; remaining: number }> {
  if (limits.length === 0) {
    return {
      underLimit: true,
      remaining: Number.MAX_SAFE_INTEGER,
    };
  }

  const limitResults = await Promise.all(
    limits.map(async ({ limit, timeWindowSeconds }) => {
      const deliveriesInTimeframe =
        await deliveryRecordStore.countDeliveriesInPastTimeframe(
          filter,
          timeWindowSeconds
        );

      return {
        progress: deliveriesInTimeframe,
        max: limit,
        remaining: Math.max(limit - deliveriesInTimeframe, 0),
        windowSeconds: timeWindowSeconds,
      };
    })
  );

  return {
    underLimit: limitResults.every(({ remaining }) => remaining > 0),
    remaining: Math.min(...limitResults.map(({ remaining }) => remaining)),
  };
}
