/**
 * Worker file for parsing RSS/Atom feeds.
 * This runs in a separate thread via Bun's Worker API.
 */

import { parseArticlesFromXml } from "../article-parser";
import { InvalidFeedException } from "../article-parser";
import type {
  WorkerTaskMessage,
  WorkerResponse,
  FeedParserTaskPayload,
  FeedParserResultPayload,
} from "./types";

declare const self: Worker;

// Handle incoming messages from the main thread
self.onmessage = async (
  event: MessageEvent<WorkerTaskMessage<FeedParserTaskPayload>>
) => {
  const { id, payload } = event.data;

  try {
    // Parse without external content injection (that happens in main thread)
    const result = await parseArticlesFromXml(payload.xml, {
      timeout: payload.options.timeout,
      formatOptions: payload.options.formatOptions,
      useParserRules: payload.options.useParserRules,
      // Explicitly NO externalFeedProperties or externalFetchFn
    });

    const response: WorkerResponse<FeedParserResultPayload> = {
      id,
      type: "result",
      success: true,
      data: {
        articles: result.articles,
        feed: result.feed,
      },
    };

    postMessage(response);
  } catch (error) {
    const err = error as Error;
    const response: WorkerResponse<never> = {
      id,
      type: "result",
      success: false,
      error: {
        name: err.name,
        message: err.message,
        feedText:
          err instanceof InvalidFeedException ? err.feedText : undefined,
      },
    };

    postMessage(response);
  }
};
