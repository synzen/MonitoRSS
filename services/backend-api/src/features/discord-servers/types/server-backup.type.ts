import { FeedFilteredFormat } from '../../feeds/entities/feed-filtered-format.entity';
import { FeedSubscriber } from '../../feeds/entities/feed-subscriber.entity';
import { Feed } from '../../feeds/entities/feed.entity';
import { ProfileSettings } from './profile-settings.type';

export interface ServerBackup {
  profile: ProfileSettings & {
    _id: string;
  };
  feeds: Feed[];
  subscribers: FeedSubscriber[];
  filteredFormats: FeedFilteredFormat[];
}
