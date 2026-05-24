import { z } from "zod";
import { logger } from "../shared/utils";
import type { ArticleFieldStore } from "../articles/comparison";
import type { FeedRetryStore } from "../stores/interfaces/feed-retry-store";
import type { ResponseHashStore } from "../stores/interfaces/response-hash-store";

export type { ResponseHashStore };

export const feedDeletedEventSchema = z.object({
  data: z.object({
    feed: z.object({
      id: z.string(),
    }),
  }),
});

export type FeedDeletedEvent = z.infer<typeof feedDeletedEventSchema>;

export function parseFeedDeletedEvent(event: unknown): FeedDeletedEvent | null {
  try {
    return feedDeletedEventSchema.parse(event);
  } catch (err) {
    if (err instanceof z.ZodError) {
      logger.error("Validation failed on incoming Feed Deleted event", {
        errors: err.issues,
      });
    } else {
      logger.error("Failed to parse Feed Deleted event", {
        error: (err as Error).stack,
      });
    }
    return null;
  }
}

export async function handleFeedDeletedEvent(
  event: FeedDeletedEvent,
  options: {
    responseHashStore: ResponseHashStore;
    articleFieldStore: ArticleFieldStore;
    feedRetryStore: FeedRetryStore;
  }
): Promise<void> {
  const { responseHashStore, articleFieldStore, feedRetryStore } = options;
  const feedId = event.data.feed.id;

  logger.debug("Received feed deleted event", { event });

  await responseHashStore.remove(feedId);
  await articleFieldStore.clear(feedId);
  await feedRetryStore.remove(feedId);

  logger.debug(`Deleted feed info for feed ${feedId}`);
}
