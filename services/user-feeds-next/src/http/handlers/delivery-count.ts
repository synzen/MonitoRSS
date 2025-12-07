/**
 * Handler for GET /v1/user-feeds/:feedId/delivery-count
 * Returns delivery count for a feed within a time window.
 */

import type { DeliveryRecordStore } from "../../delivery-record-store";
import { jsonResponse, parseIntQueryParam } from "../utils";

export async function handleDeliveryCount(
  req: Request,
  url: URL,
  feedId: string,
  deliveryRecordStore: DeliveryRecordStore
): Promise<Response> {
  const timeWindowSec = parseIntQueryParam(url, "timeWindowSec");

  const count = await deliveryRecordStore.countDeliveriesInPastTimeframe(
    { feedId },
    timeWindowSec
  );

  return jsonResponse({
    result: {
      count,
    },
  });
}
