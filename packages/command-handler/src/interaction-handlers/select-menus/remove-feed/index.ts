import { SelectMenuInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import {
  InteractionContainerSymbols,
  InteractionLogger,
  InteractionServices,
  InteractionTranslate,
} from '../../interaction-container.type';
import SelectMenusInterface from '../select-menus.interface';

@injectable()
export default class RemoveFeedSelectMenu implements SelectMenusInterface {
  @inject(InteractionContainerSymbols.Services) services!: InteractionServices;

  @inject(InteractionContainerSymbols.Logger) logger!: InteractionLogger;

  @inject(InteractionContainerSymbols.Translate) translate!: InteractionTranslate;

  async execute(interaction: SelectMenuInteraction): Promise<void> {
    const feedId = interaction.values[0];

    const foundFeed = await this.services.feedService.findById(feedId);
    
    if (!foundFeed || foundFeed.guild !== interaction.guildId) {
      await interaction.reply(this.translate('responses.remove-feed.not_found'));
      
      return;
    }

    await this.services.feedService.removeOne(feedId);

    await interaction.update({
      content: this.translate('responses.remove-feed.success', {
        url: foundFeed.url,
      }),
      components: [],
    });
  }
}
