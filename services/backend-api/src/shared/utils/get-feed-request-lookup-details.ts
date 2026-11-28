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

// Lookup details carry the credential owner's Bearer token so credentialed
// reddit fetches validate and route with the owner's grant: the fetch path
// stays the plain (canonical) URL — the redditofficial provider adapter
// builds the oauth listing URL from it — and the token rides the request
// headers. Null for non-reddit urls or sources without a reddit grant.
export function getFeedRequestLookupDetails({
  feed,
  credentials,
  decryptionKey,
}: {
  feed: {
    url: string;
    feedRequestLookupKey?: string;
  };
  credentials: FeedCredentialSource;
  decryptionKey: string | undefined;
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

  return {
    key: feedRequestLookupKey,
    headers: {
      Authorization: `Bearer ${decrypt(encryptedToken, decryptionKey)}`,
    },
  };
}
