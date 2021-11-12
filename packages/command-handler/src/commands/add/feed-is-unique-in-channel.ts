import { FeedRepository } from '@monitorss/models';

export default async function feedIsUniqueInChannel(
  channelId: string,
  feedUrl: string,
  feedRepository: FeedRepository,
) {
  const feedsWithUrl = await feedRepository.findByField('url', feedUrl);
  
  const everyFeedHasDifferentChannel = feedsWithUrl.every(feed => feed.channel !== channelId);

  if (!everyFeedHasDifferentChannel) {
    return false;
    
  }

  return true;
}
