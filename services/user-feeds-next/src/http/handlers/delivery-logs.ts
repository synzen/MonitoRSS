/**
 * Handler for GET /v1/user-feeds/:feedId/delivery-logs
 * Returns delivery logs for a feed.
 */

import type { DeliveryRecordStore } from "../../delivery-record-store";
import {
  jsonResponse,
  parseIntQueryParam,
  parseOptionalIntQueryParam,
} from "../utils";

export async function handleDeliveryLogs(
  req: Request,
  url: URL,
  feedId: string,
  deliveryRecordStore: DeliveryRecordStore
): Promise<Response> {
  const skip = parseIntQueryParam(url, "skip");
  const limit = parseOptionalIntQueryParam(url, "limit") ?? 25;

  const logs = await deliveryRecordStore.getDeliveryLogs({
    feedId,
    skip,
    limit,
  });

  return jsonResponse({
    result: {
      logs,
    },
  });
}
