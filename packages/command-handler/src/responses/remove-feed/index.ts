import { SelectMenuInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import {
  commandContainerSymbols,
  CommandLogger,
  CommandServices,
  CommandTranslate,
} from '../../types/command-container.type';
import ResponseInterface from '../response.interface';

@injectable()
export default class ResponseRemoveFeed implements ResponseInterface {
  @inject(commandContainerSymbols.CommandServices) commandServices!: CommandServices;

  @inject(commandContainerSymbols.CommandLogger) logger!: CommandLogger;

  @inject(commandContainerSymbols.CommandTranslate) translate!: CommandTranslate;

  /**
   * The ID that will be used for recognizing Discord interactions that this response can handle.
   */
  static customId = 'remove-feed';

  async execute(interaction: SelectMenuInteraction): Promise<void> {
    const feedId = interaction.values[0];

    const foundFeed = await this.commandServices.feedService.findById(feedId);
    
    if (!foundFeed || foundFeed.guild !== interaction.guildId) {
      await interaction.reply(this.translate('responses.remove-feed.not_found'));
      return;
    }

    await this.commandServices.feedService.removeOne(feedId);

    await interaction.update({
      content: this.translate('responses.remove-feed.success', {
        url: foundFeed.url,
      }),
      components: []
    })
  }
}
