import { Feed, ModelExports } from '@monitorss/models';
import { inject, injectable } from 'inversify';

@injectable()
export default class FeedService {
  constructor(
    @inject('ModelExports') private readonly models: ModelExports,
  ) {}

  async findByGuild(guildId: string) {
    return this.models.Feed.findByField('guild', guildId);
  }

  async find(query: Partial<Feed>, page = 0, limit = 10): Promise<Feed[]> {
    return this.models.Feed.find(query, page, limit);
  }

  async count(query: Partial<Feed>) {
    return this.models.Feed.count(query);
  }

  async removeOne(feedId: string) {
    await this.models.Feed.removeById(feedId);
  }

  async findById(feedId: string) {
    return this.models.Feed.findById(feedId);
  }
}
