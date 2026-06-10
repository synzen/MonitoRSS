import { randomUUID } from "node:crypto";

// Reconciles feedRequestLookupKey presence against a credential owner's
// reddit grant state: feeds backed by an active credential get a key (so
// fetches are credentialed and keyed per feed), feeds backed by a missing,
// expired, or revoked credential lose theirs. The owner-specific part — which
// feeds a credential backs — lives in the aggregations the caller passes in.
export async function reconcileFeedLookupKeys({
  feedsWithActiveCredentials,
  feedsWithDeadCredentials,
  bulkUpdateLookupKeys,
}: {
  feedsWithActiveCredentials: AsyncIterable<{
    feedId: string;
    lookupKey?: string;
  }>;
  feedsWithDeadCredentials: AsyncIterable<{ feedId: string }>;
  bulkUpdateLookupKeys: (
    ops: Array<{
      feedId: string;
      action: "set" | "unset";
      lookupKey?: string;
    }>,
  ) => Promise<void>;
}): Promise<void> {
  const bulkWriteOps: Array<{
    feedId: string;
    action: "set" | "unset";
    lookupKey?: string;
  }> = [];

  for await (const { feedId, lookupKey } of feedsWithActiveCredentials) {
    if (lookupKey) {
      continue;
    }

    bulkWriteOps.push({
      feedId,
      action: "set",
      lookupKey: randomUUID(),
    });
  }

  for await (const { feedId } of feedsWithDeadCredentials) {
    bulkWriteOps.push({
      feedId,
      action: "unset",
    });
  }

  if (bulkWriteOps.length) {
    await bulkUpdateLookupKeys(bulkWriteOps);
  }
}
