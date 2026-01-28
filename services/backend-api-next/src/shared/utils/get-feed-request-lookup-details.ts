import { UserExternalCredentialType } from "../../repositories/shared/enums";
import type { FeedRequestLookupDetails } from "../types/feed-request-lookup-details.type";
import { decrypt } from "./decrypt";
import { getRedditUrlRegex } from "./get-reddit-url-regex";

interface FeedInput {
  url: string;
  feedRequestLookupKey?: string;
}

interface UserInput {
  externalCredentials?: Array<{
    type: UserExternalCredentialType;
    data: Record<string, string>;
  }>;
}

export function getFeedRequestLookupDetails({
  feed,
  user,
  decryptionKey,
}: {
  feed: FeedInput;
  user: UserInput;
  decryptionKey: string | undefined;
}): FeedRequestLookupDetails | null {
  const { url, feedRequestLookupKey } = feed;
  const { externalCredentials } = user;

  if (!decryptionKey || !feedRequestLookupKey) {
    return null;
  }

  if (!getRedditUrlRegex().test(url)) {
    return null;
  }

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
