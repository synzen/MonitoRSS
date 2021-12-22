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

    if (!supporter) {
      return false;
    }

    // If the supporter is a patron, we must check the patron reference
    if (!supporter.patron) {
      return true;
    }

    const patron = await this.patronService.findByDiscordId(discordUserId);
    
    return !!patron;
  }

  /**
   * Get the server IDs that this user has backed.
   *
   * @param discordUserId The ID of the Discord user.
   * @returns 
   */
  async getSupporterGuilds(discordUserId: string) {
    const supporter = await this.supporterService.findByDiscordId(discordUserId);
    
    return supporter?.guilds || [];
  }

  /**
   * Add a server to the user's supporter list.
   *
   * @param discordUserId The ID of the Discord user.
   * @param guildId The ID of the server.
   */
  async addSupporterGuild(discordUserId: string, guildId: string) {
    await this.supporterService.addGuildToSupporter(discordUserId, guildId);
  }

  /**
   * Remove a server from the user's supporter list.
   * 
   * @param discordUserId The ID of the Discord user.
   * @param guildId The ID of the server.
   */
  async removeSupporterGuild(discordUserId: string, guildId: string) {
    await this.supporterService.removeGuildFromSupporter(discordUserId, guildId);
  }

  /**
   * Get the maximum number of guilds that the given Discord user can have backed.
   *
   * @param discordUserId The ID of the Discord user.
   * @returns The maximum number of guilds that the user can have backed.
   */
  async getMaxSupporterGuildCount(discordUserId: string) {
    const supporter = await this.supporterService.findByDiscordId(discordUserId);

    if (!supporter) {
      return 1;
    }

    if (!supporter.patron) {
      return supporter.maxGuilds || 1;
    }

    return this.patronService.getGuildLimitFromDiscordId(discordUserId);
  }
  
}
