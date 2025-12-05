import { feedV2EventSchema, type FeedV2Event } from "./schemas";
import { z } from "zod";
import { fetchFeed, FeedResponseRequestStatus } from "./feed-fetcher";
import {
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestInternalException,
  FeedRequestParseException,
  FeedRequestTimedOutException,
} from "./feed-fetcher/exceptions";

export function parseFeedV2Event(event: unknown): FeedV2Event | null {
  try {
    return feedV2EventSchema.parse(event);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("Validation failed on incoming Feed V2 event", {
        errors: err.issues,
      });
    } else {
      console.error("Failed to parse Feed V2 event", {
        error: (err as Error).stack,
      });
    }
    return null;
  }
}

export async function handleFeedV2Event(event: FeedV2Event): Promise<boolean> {
  const { feed } = event.data;

  console.log(`Handling event for feed ${feed.id} with url ${feed.url}`);

  // Fetch the feed
  let response: Awaited<ReturnType<typeof fetchFeed>> | null = null;

  try {
    response = await fetchFeed(feed.requestLookupDetails?.url || feed.url, {
      hashToCompare: undefined, // TODO: Implement hash caching
      lookupDetails: feed.requestLookupDetails,
    });
  } catch (err) {
    if (
      err instanceof FeedRequestInternalException ||
      err instanceof FeedRequestParseException ||
      err instanceof FeedRequestBadStatusCodeException ||
      err instanceof FeedRequestFetchException ||
      err instanceof FeedRequestTimedOutException
    ) {
      console.log(
        `Ignoring feed event due to expected exception: ${(err as Error).name}`
      );
      return false;
    }
    throw err;
  }

  if (
    !response ||
    response.requestStatus === FeedResponseRequestStatus.Pending ||
    response.requestStatus === FeedResponseRequestStatus.MatchedHash
  ) {
    console.log(`No response body - pending request or matched hash`);
    return false;
  }

  console.log(
    `Fetched feed body (${response.body.length} chars), hash: ${response.bodyHash}`
  );

  // TODO: Parse articles from XML
  // TODO: Deliver articles

  return true;
}
