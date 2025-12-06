/**
 * Shared delivery types.
 *
 * Contains interfaces used across the delivery module to avoid circular dependencies.
 */

import type { LogicalExpression } from "../article-filters";
import type { FeedV2Event } from "../schemas";

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface MediumRateLimit {
  limit: number;
  timeWindowSeconds: number;
}

// ============================================================================
// Delivery Medium Interface
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
    components?: Array<{
      type: number;
      components: Array<{
        type: number;
        style: number;
        label: string;
        emoji?: {
          id: string;
          name: string | null;
          animated: boolean | null;
        } | null;
        url: string | null;
      }>;
    }> | null;
    componentsV2?: Array<Record<string, unknown>> | null;
  };
}

// ============================================================================
// Limit State
// ============================================================================

/**
 * LimitState tracks remaining deliveries for rate limiting.
 * Matches the interface used in user-feeds DeliveryService.
 */
export interface LimitState {
  remaining: number;
  remainingInMedium: number;
}

// ============================================================================
// Medium Rejection Events
// ============================================================================

/**
 * Event emitted when an article is rejected due to bad message format.
 */
export interface MediumBadFormatEvent {
  feedId: string;
  mediumId: string;
  errorMessage: string;
}

/**
 * Event emitted when a medium has missing permissions.
 */
export interface MediumMissingPermissionsEvent {
  feedId: string;
  mediumId: string;
}

/**
 * Event emitted when a medium should be disabled because it was not found.
 */
export interface MediumNotFoundEvent {
  feedId: string;
  mediumId: string;
}

/**
 * Combined type for medium rejection events.
 */
export type MediumRejectionEvent =
  | { type: "badFormat"; data: MediumBadFormatEvent }
  | { type: "missingPermissions"; data: MediumMissingPermissionsEvent }
  | { type: "notFound"; data: MediumNotFoundEvent };

// ============================================================================
// Delivery Context
// ============================================================================

/**
 * Context passed to delivery functions.
 */
export interface DeliverArticleContext {
  mediumId: string;
  feedId: string;
  guildId: string;
  filterReferences?: Map<string, string>;
}
