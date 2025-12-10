/**
 * Types for worker pool message communication.
 * Used for type-safe serialization between main thread and workers.
 */

import type {
  UserFeedFormatOptions,
  PostProcessParserRule,
  Article,
} from "../types";

// Generic worker message types

export interface WorkerTaskMessage<T = unknown> {
  /** Unique task ID for correlating responses */
  id: string;
  type: "task";
  payload: T;
}

export interface WorkerResultMessage<T = unknown> {
  id: string;
  type: "result";
  success: true;
  data: T;
}

export interface WorkerErrorMessage {
  id: string;
  type: "result";
  success: false;
  error: {
    name: string;
    message: string;
    /** For InvalidFeedException */
    feedText?: string;
  };
}

export type WorkerResponse<T> = WorkerResultMessage<T> | WorkerErrorMessage;

// Feed parser specific types

export interface FeedParserTaskPayload {
  xml: string;
  options: {
    timeout?: number;
    formatOptions?: UserFeedFormatOptions;
    /** PostProcessParserRule enum values */
    useParserRules?: PostProcessParserRule[];
  };
}

export interface FeedParserResultPayload {
  articles: Article[];
  feed: {
    title?: string;
  };
}
