/**
 * Feed parser pool - high-level wrapper for parsing feeds in workers.
 *
 * This module provides a drop-in replacement for parseArticlesFromXml
 * that offloads CPU-intensive parsing to worker threads.
 */

import { WorkerPool } from "./worker-pool";
import {
  parseArticlesFromXml as parseArticlesSync,
  FeedParseTimeoutException,
  InvalidFeedException,
} from "../article-parser";
import {
  injectExternalContent,
  type ExternalFeedProperty,
  type ExternalFetchFn,
} from "../inject-external-content";
import type {
  ParseArticlesResult,
  UserFeedFormatOptions,
  PostProcessParserRule,
} from "../types";
import type { FeedParserTaskPayload, FeedParserResultPayload } from "./types";
import { MAX_ARTICLE_INJECTION_ARTICLE_COUNT } from "../../../shared/constants";
import { chunkArray, logger } from "../../../shared/utils";

// Singleton pool instance
let pool: WorkerPool<FeedParserTaskPayload, FeedParserResultPayload> | null =
  null;

// Configuration from environment
const WORKER_POOL_MIN_WORKERS = parseInt(
  process.env.USER_FEEDS_WORKER_POOL_MIN_WORKERS || "2",
  10
);
const WORKER_POOL_MAX_WORKERS = parseInt(
  process.env.USER_FEEDS_WORKER_POOL_MAX_WORKERS ||
    String(
      typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 4
    ),
  10
);

/**
 * Get or create the singleton worker pool.
 */
function getPool(): WorkerPool<FeedParserTaskPayload, FeedParserResultPayload> {
  if (!pool) {
    pool = new WorkerPool<FeedParserTaskPayload, FeedParserResultPayload>({
      workerPath: new URL("./feed-parser-worker.ts", import.meta.url).href,
      minWorkers: WORKER_POOL_MIN_WORKERS,
      maxWorkers: WORKER_POOL_MAX_WORKERS,
      idleTimeoutMs: 30000,
    });
    logger.info(
      `Feed parser worker pool initialized with ${WORKER_POOL_MIN_WORKERS}-${WORKER_POOL_MAX_WORKERS} workers`
    );
  }
  return pool;
}

/**
 * Terminate the worker pool and clean up resources.
 * Call this during graceful shutdown.
 */
export async function terminateFeedParserPool(): Promise<void> {
  if (pool) {
    logger.info("Terminating feed parser worker pool");
    await pool.terminate();
    pool = null;
  }
}

/**
 * Get worker pool statistics.
 */
export function getFeedParserPoolStats() {
  return pool?.stats() ?? null;
}

/**
 * Check if we should bypass workers (test environment or pool disabled).
 */
function shouldBypassWorkers(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.USER_FEEDS_DISABLE_WORKER_POOL === "true"
  );
}

export interface ParseArticlesOptions {
  timeout?: number;
  formatOptions?: UserFeedFormatOptions;
  useParserRules?: PostProcessParserRule[];
  externalFeedProperties?: ExternalFeedProperty[];
  externalFetchFn?: ExternalFetchFn;
}

/**
 * Parse articles from XML, using worker pool when available.
 *
 * This function:
 * 1. Bypasses workers in test environment (direct call)
 * 2. Uses worker pool for XML parsing (CPU-intensive)
 * 3. Performs external content injection in main thread (I/O-bound)
 *
 * The signature matches the original parseArticlesFromXml for drop-in replacement.
 */
export async function parseArticlesFromXmlWithWorkers(
  xml: string,
  options: ParseArticlesOptions = {}
): Promise<ParseArticlesResult> {
  // Bypass workers in test environment
  if (shouldBypassWorkers()) {
    return parseArticlesSync(xml, options);
  }

  // Parse XML in worker (without external content injection)
  const workerPool = getPool();

  let workerResult: FeedParserResultPayload;

  try {
    workerResult = await workerPool.exec({
      xml,
      options: {
        timeout: options.timeout,
        formatOptions: options.formatOptions,
        useParserRules: options.useParserRules,
      },
    });
  } catch (error) {
    const err = error as Error & { feedText?: string };

    // Reconstruct proper exception types
    if (err.name === "FeedParseTimeoutException") {
      throw new FeedParseTimeoutException();
    }
    if (err.name === "InvalidFeedException") {
      throw new InvalidFeedException(err.message, err.feedText || xml);
    }

    throw error;
  }

  // Result already has proper Article types from worker
  const result: ParseArticlesResult = {
    articles: workerResult.articles,
    feed: workerResult.feed,
  };

  // Inject external content in main thread (requires async fetch)
  if (
    options.externalFeedProperties?.length &&
    options.externalFetchFn &&
    result.articles.length > 0 &&
    result.articles.length <= MAX_ARTICLE_INJECTION_ARTICLE_COUNT
  ) {
    logger.debug(
      `Injecting external content for ${result.articles.length} articles with ${options.externalFeedProperties.length} properties`
    );

    // Process in chunks of 25 with 1s delay between chunks (matching original behavior)
    const chunkedArticles = chunkArray(result.articles, 25);

    for (const chunk of chunkedArticles) {
      await injectExternalContent(
        chunk,
        options.externalFeedProperties,
        options.externalFetchFn
      );
      await new Promise((res) => setTimeout(res, 1000));
    }

    logger.debug(`External content injection complete`);
  }

  return result;
}
