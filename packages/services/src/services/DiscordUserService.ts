import { inject, injectable } from 'inversify';
import PatronService from './PatronService';
import SupporterService from './SupporterService';

@injectable()
export default class DiscordUserService {
  constructor(
    @inject(SupporterService) private readonly supporterService: SupporterService,
    @inject(PatronService) private readonly patronService: PatronService,
  ) {}

  /**
   * Check whether a Discord user is supporting the bot.
   *
   * @param discordUserId The ID of the Discord user.
   * @returns If the Discord user is a supporter.
   */
  async isSupporter(discordUserId: string): Promise<boolean> {
    const supporter = await this.supporterService.findByDiscordId(discordUserId);

    if (supporter) {
      return true;
    }

    const patron = await this.patronService.findByDiscordId(discordUserId);
    
    return !!patron;
  }
}
