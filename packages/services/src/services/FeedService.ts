import { ModelExports } from '@monitorss/models';
import { inject, injectable } from 'inversify';

@injectable()
export default class FeedService {
  constructor(
    @inject('ModelExports') private readonly models: ModelExports,
  ) {}

  async findByGuild(guildId: string) {
    return this.models.Feed.findByField('guild', guildId);
  }

  async removeOne(feedId: string) {
    await this.models.Feed.removeById(feedId);
  }

  async findById(feedId: string) {
    return this.models.Feed.findById(feedId);
  }
}
