/**
 * Worker pool module exports.
 */

export {
  parseArticlesFromXmlWithWorkers,
  terminateFeedParserPool,
  getFeedParserPoolStats,
  type ParseArticlesOptions,
} from "./feed-parser-pool";

export { WorkerPool, type WorkerPoolOptions } from "./worker-pool";

export type {
  WorkerTaskMessage,
  WorkerResultMessage,
  WorkerErrorMessage,
  WorkerResponse,
  FeedParserTaskPayload,
  FeedParserResultPayload,
} from "./types";
