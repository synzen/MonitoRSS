import {
  UserExternalCredentialStatus,
  UserExternalCredentialType,
} from "../../repositories/shared/enums";
import type { FeedRequestLookupDetails } from "../types/feed-request-lookup-details.type";
import { decrypt } from "./decrypt";
import { isRedditFeedUrl } from "./is-reddit-feed-url";

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

export function getFeedRequestLookupDetails({
  feed,
  credentials,
  decryptionKey,
  redditFeedBaseUrl,
}: {
  feed: { url: string; feedRequestLookupKey?: string };
  credentials: FeedCredentialSource;
  decryptionKey: string | undefined;
  // BACKEND_API_REDDIT_AUTHENTICATED_FEED_BASE_URL; overridable so tests can
  // point authenticated reddit fetches at a mock server.
  redditFeedBaseUrl: string | undefined;
}): FeedRequestLookupDetails | null {
  const { url, feedRequestLookupKey } = feed;

  if (!decryptionKey || !feedRequestLookupKey) {
    return null;
  }

  if (!isRedditFeedUrl(url)) {
    return null;
  }

  const encryptedToken = credentials.externalCredentials?.find(
    (cred) => cred.type === UserExternalCredentialType.Reddit,
  )?.data?.accessToken;

  if (!encryptedToken) {
    return null;
  }

  const decrypted = decrypt(encryptedToken, decryptionKey);

  const parsedUrl = new URL(url);
  const baseUrl = redditFeedBaseUrl || "https://oauth.reddit.com";
  const urlToFetch = `${baseUrl}${parsedUrl.pathname}${parsedUrl.search}`;

  return {
    key: feedRequestLookupKey,
    url: urlToFetch,
    headers: {
      Authorization: `Bearer ${decrypted}`,
      "user-agent": "MonitoRSS:1.0",
    },
  };
}
