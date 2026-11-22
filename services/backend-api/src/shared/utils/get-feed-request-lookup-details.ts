import {
  UserExternalCredentialStatus,
  UserExternalCredentialType,
} from "../../repositories/shared/enums";
import type { FeedRequestLookupDetails } from "../types/feed-request-lookup-details.type";

// A holder of external credentials a feed can fetch with: a user or a
// workspace. Lookup-detail construction reads `data`; connection gates read
// `status`.
export interface FeedCredentialSource {
  externalCredentials?: Array<{
    type: UserExternalCredentialType | string;
    status?: UserExternalCredentialStatus | string;
    data?: Record<string, string>;
  }>;
}

// The single place that decides which credential source backs a feed:
// workspace feeds resolve ONLY the workspace connection and personal feeds
// ONLY the creator's — never a fallback from one to the other, so a feed's
// fetch health is a function of exactly one connection. A workspace feed with
// no workspace connection resolves to an empty credential list (fails closed).
//
// Batch pipelines that aggregate both sources alongside feeds pick here;
// request-path code resolves through FeedCredentialsService instead.
export function pickFeedCredentialSource({
  feed,
  user,
  workspace,
}: {
  feed: { workspaceId?: string | null };
  user: FeedCredentialSource;
  workspace?: FeedCredentialSource | null;
}): FeedCredentialSource {
  if (!feed.workspaceId) {
    return user;
  }

  return workspace ?? { externalCredentials: [] };
}

// Lookup details previously carried the credential owner's oauth.reddit.com
// URL and Bearer headers for authenticated reddit RSS fetching. Reddit's RSS
// endpoints no longer exist (platform feeds fetch through provider adapters
// that never use reddit credentials), so nothing constructs lookup details
// anymore; the plumbing that consumes them is inert pending removal.
export function getFeedRequestLookupDetails(
  _input: {
    feed: {
      url: string;
      feedRequestLookupKey?: string;
      isPremiumFeed?: boolean;
    };
    credentials: FeedCredentialSource;
    decryptionKey: string | undefined;
    redditFeedBaseUrl: string | undefined;
  },
): FeedRequestLookupDetails | null {
  return null;
}
