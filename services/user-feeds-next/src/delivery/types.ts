import type { JobResponse } from "@synzen/discord-rest";
import type {
  JobData,
  JobResponseError,
} from "@synzen/discord-rest/dist/RESTConsumer";
import type { LogicalExpression } from "../articles/filters";
import type { FeedV2Event } from "../shared/schemas";
import type { FilterExplainBlockedDetail } from "../shared/delivery-preview";

// ============================================================================
// Rate Limiting
// ============================================================================

export interface MediumRateLimit {
  limit: number;
  timeWindowSeconds: number;
}

export interface LimitState {
  remaining: number;
  remainingInMedium: number;
}

// ============================================================================
// Delivery Medium
// ============================================================================

export interface DeliveryMedium {
  id: string;
  filters?: {
    expression: LogicalExpression;
  } | null;
  rateLimits?: MediumRateLimit[] | null;
  details: {
    guildId: string;
    channel?: {
      id: string;
      type?: "forum" | "thread" | "new-thread";
    };
    webhook?: {
      id: string;
      token: string;
      name?: string;
      iconUrl?: string;
      threadId?: string | null;
      type?: "forum";
    };
    content?: string;
    embeds?: FeedV2Event["data"]["mediums"][number]["details"]["embeds"];
    splitOptions?: {
      splitChar?: string;
      appendChar?: string;
      prependChar?: string;
    };
    placeholderLimits?: Array<{
      placeholder: string;
      characterCount: number;
      appendString?: string;
    }>;
    enablePlaceholderFallback?: boolean;
    mentions?: {
      targets?: Array<{
        id: string;
        type: "user" | "role";
        filters?: { expression: LogicalExpression };
      }>;
    };
    customPlaceholders?: Array<{
      id: string;
      referenceName: string;
      sourcePlaceholder: string;
      steps: Array<{
        type: string;
        regexSearch?: string;
        regexSearchFlags?: string;
        replacementString?: string;
        format?: string;
        timezone?: string;
        locale?: string;
      }>;
    }>;
    forumThreadTitle?: string;
    forumThreadTags?: Array<{
      id: string;
      filters?: { expression: LogicalExpression };
    }>;
    channelNewThreadTitle?: string;
    channelNewThreadExcludesPreview?: boolean;
    formatter?: {
      stripImages?: boolean;
      formatTables?: boolean;
      disableImageLinkPreviews?: boolean;
      ignoreNewLines?: boolean;
    };
    components?: FeedV2Event["data"]["mediums"][number]["details"]["components"];
    componentsV2?: FeedV2Event["data"]["mediums"][number]["details"]["componentsV2"];
  };
}

// ============================================================================
// Delivery Context
// ============================================================================

export interface DeliverArticleContext {
  mediumId: string;
  feedId: string;
  feedUrl: string;
  guildId: string;
  filterReferences?: Map<string, string>;
}

// ============================================================================
// Rejection Events
// ============================================================================

export enum ArticleDeliveryRejectedCode {
  BadRequest = "user-feeds/bad-request",
  Forbidden = "user-feeds/forbidden",
  MediumNotFound = "user-feeds/medium-not-found",
}

export interface MediumBadFormatEvent {
  feedId: string;
  mediumId: string;
  articleId?: string;
  responseBody: string;
}

export interface MediumMissingPermissionsEvent {
  feedId: string;
  mediumId: string;
}

export interface MediumNotFoundEvent {
  feedId: string;
  mediumId: string;
}

export type MediumRejectionEvent =
  | { type: "badFormat"; data: MediumBadFormatEvent }
  | { type: "missingPermissions"; data: MediumMissingPermissionsEvent }
  | { type: "notFound"; data: MediumNotFoundEvent };

// ============================================================================
// Delivery Result Types
// ============================================================================

export interface DiscordDeliveryResult {
  job: JobData;
  result: JobResponse<never> | JobResponseError;
}

export interface DeliveryJobMeta {
  feedId: string;
  articleIdHash: string;
  mediumId: string;
  articleId?: string;
}

export interface ProcessedDeliveryResult {
  status: import("../stores/interfaces/delivery-record-store").ArticleDeliveryStatus;
  errorCode?: import("../stores/interfaces/delivery-record-store").ArticleDeliveryErrorCode;
  rejectedCode?: ArticleDeliveryRejectedCode;
  internalMessage?: string;
  externalDetail?: string;
  meta: DeliveryJobMeta;
}

// ============================================================================
// Preview Diagnostic Types
// ============================================================================

export interface RateLimitDiagnosticParams {
  articleIdHash: string;
  isFeedLevel: boolean;
  mediumId?: string;
  currentCount: number;
  limit: number;
  timeWindowSeconds: number;
  remaining: number;
}

export interface MediumFilterDiagnosticParams {
  articleIdHash: string;
  mediumId: string;
  filterExpression: unknown | null;
  filterResult: boolean;
  explainBlocked: FilterExplainBlockedDetail[];
  explainMatched: FilterExplainBlockedDetail[];
}
