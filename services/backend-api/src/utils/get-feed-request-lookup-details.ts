import { FeedRequestLookupDetails } from "../common/types/feed-request-lookup-details.type";
import { UserFeed } from "../features/user-feeds/entities";
import { User } from "../features/users/entities/user.entity";

function getFeedRequestLookupDetails({
  feed: { url, feedRequestLookupKey },
  user: { externalCredentials },
}: {
  feed: Pick<UserFeed, "feedRequestLookupKey" | "url">;
  user: Pick<User, "externalCredentials">;
}): FeedRequestLookupDetails | null {
  if (!/^http(s?):\/\/(www.)?(old\.)?reddit\.com/i.test(url)) {
    return null;
  }

  if (!feedRequestLookupKey) {
    return null;
  }

  const accessToken = externalCredentials?.find(
    (cred) => cred.type === "reddit"
  )?.data?.accessToken;

  if (!accessToken) {
    return null;
  }

  const u = new URL(url);
  const urlToFetch = `https://oauth.reddit.com${u.pathname}${u.search}`;

  return {
    key: feedRequestLookupKey,
    url: urlToFetch,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export default getFeedRequestLookupDetails;
