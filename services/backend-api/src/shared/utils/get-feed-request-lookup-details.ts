import { UserExternalCredentialType } from "../../repositories/shared/enums";
import type { FeedRequestLookupDetails } from "../types/feed-request-lookup-details.type";
import { decrypt } from "./decrypt";
import { isRedditFeedUrl } from "./is-reddit-feed-url";

interface FeedInput {
  url: string;
  feedRequestLookupKey?: string;
  workspaceId?: string;
}

interface ExternalCredentialSource {
  externalCredentials?: Array<{
    type: UserExternalCredentialType | string;
    data: Record<string, string>;
  }>;
}

export function getFeedRequestLookupDetails({
  feed,
  user,
  workspace,
  decryptionKey,
}: {
  feed: FeedInput;
  user: ExternalCredentialSource;
  // The credential source for a workspace feed. Workspace feeds resolve ONLY
  // workspace credentials and personal feeds ONLY the creator's — never a
  // fallback from one to the other, so a feed's fetch health is a function of
  // exactly one connection.
  workspace?: ExternalCredentialSource | null;
  decryptionKey: string | undefined;
}): FeedRequestLookupDetails | null {
  const { url, feedRequestLookupKey } = feed;

  if (!decryptionKey || !feedRequestLookupKey) {
    return null;
  }

  if (!isRedditFeedUrl(url)) {
    return null;
  }

  const externalCredentials = feed.workspaceId
    ? workspace?.externalCredentials
    : user.externalCredentials;

  const encryptedToken = externalCredentials?.find(
    (cred) => cred.type === UserExternalCredentialType.Reddit,
  )?.data?.accessToken;

  if (!encryptedToken) {
    return null;
  }

  const decrypted = decrypt(encryptedToken, decryptionKey);

  const parsedUrl = new URL(url);
  const urlToFetch = `https://oauth.reddit.com${parsedUrl.pathname}${parsedUrl.search}`;

  return {
    key: feedRequestLookupKey,
    url: urlToFetch,
    headers: {
      Authorization: `Bearer ${decrypted}`,
      "user-agent": "MonitoRSS:1.0",
    },
  };
}
