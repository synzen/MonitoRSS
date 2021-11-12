import { FeedFetcher } from '@monitorss/feed-fetcher';
import { Feed } from '@monitorss/models';

export default async function getFeedToSave(
  guildId: string,
  channelId: string,
  url: string,
): Promise<Feed> {
  const feedFetcher = new FeedFetcher();
  const { articleList } = await feedFetcher.fetchFeed(url);
  
  return {
    url,
    title: articleList[0]?.meta?.title || 'Untitled',
    channel: channelId,
    guild: guildId,
  };
}
