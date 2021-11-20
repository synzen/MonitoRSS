import { ModelExports } from '@monitorss/models';
import { inject, injectable } from 'inversify';

@injectable()
export default class ProfileService {
  constructor(
    @inject('ModelExports') private readonly models: ModelExports,
  ) {}

  async findOne(guildId: string) {
    return this.models.Profile.findOne(guildId);
  }
}
