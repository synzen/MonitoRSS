/**
 * Feed parser pool - high-level wrapper for parsing feeds.
 *
 * NOTE: Worker pool is currently disabled (bypassed). This module delegates
 * directly to the synchronous parser.
 */

import {
  parseArticlesFromXml as parseArticlesSync,
} from "../article-parser";
import type {
  ParseArticlesResult,
  UserFeedFormatOptions,
  PostProcessParserRule,
} from "../types";
import type {
  ExternalFeedProperty,
  ExternalFetchFn,
} from "../inject-external-content";

/**
 * Terminate the worker pool and clean up resources.
 * Currently a no-op since workers are disabled.
 */
export async function terminateFeedParserPool(): Promise<void> {
  // No-op: workers are disabled
}

/**
 * Get worker pool statistics.
 * Returns null since workers are disabled.
 */
export function getFeedParserPoolStats() {
  return null;
}

export interface ParseArticlesOptions {
  timeout?: number;
  formatOptions?: UserFeedFormatOptions;
  useParserRules?: PostProcessParserRule[];
  externalFeedProperties?: ExternalFeedProperty[];
  externalFetchFn?: ExternalFetchFn;
}

/**
 * Parse articles from XML.
 * Currently delegates directly to synchronous parser (workers disabled).
 */
export async function parseArticlesFromXmlWithWorkers(
  xml: string,
  options: ParseArticlesOptions = {}
): Promise<ParseArticlesResult> {
  return parseArticlesSync(xml, options);
}
