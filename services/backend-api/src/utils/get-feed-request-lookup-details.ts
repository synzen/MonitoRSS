import { FeedRequestLookupDetails } from "../common/types/feed-request-lookup-details.type";
import { UserFeed } from "../features/user-feeds/entities";
import { User } from "../features/users/entities/user.entity";
import decrypt from "./decrypt";

function getFeedRequestLookupDetails({
  feed: { url, feedRequestLookupKey },
  user: { externalCredentials },
  decryptionKey,
}: {
  feed: Pick<UserFeed, "feedRequestLookupKey" | "url">;
  user: Pick<User, "externalCredentials">;
  decryptionKey: string | undefined;
}): FeedRequestLookupDetails | null {
  if (!decryptionKey || !feedRequestLookupKey) {
    return null;
  }

  if (!/^http(s?):\/\/(www.)?(old\.)?reddit\.com/i.test(url)) {
    return null;
  }

  const encryptedToken = externalCredentials?.find(
    (cred) => cred.type === "reddit"
  )?.data?.accessToken as string | undefined;

  if (!encryptedToken) {
    return null;
  }

  const decrypted = decrypt(encryptedToken, decryptionKey);

  const u = new URL(url);
  const urlToFetch = `https://oauth.reddit.com${u.pathname}${u.search}`;

  return {
    key: feedRequestLookupKey,
    url: urlToFetch,
    headers: {
      Authorization: `Bearer ${decrypted}`,
    },
  };
}

export default getFeedRequestLookupDetails;
