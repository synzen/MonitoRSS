import { SelectMenuInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import {
  InteractionContainerSymbols,
  InteractionServices,
  InteractionTranslate,
} from '../../interaction-container.type';
import SelectMenusInterface from '../select-menus.interface';

@injectable()
export default class SubRemoveUser implements SelectMenusInterface {
  @inject(InteractionContainerSymbols.Services) services!: InteractionServices;

  @inject(InteractionContainerSymbols.Translate) translate!: InteractionTranslate;

  async execute(interaction: SelectMenuInteraction): Promise<void> {
    const feedIds = interaction.values;
    const userId = interaction.member.user.id;

    await this.services.feedSubscriberService.deleteForUserFeeds({
      userId,
      feedIds,
    });

    const associatedFeeds = await this.services.feedService.findByIds(feedIds);

    const responseStrings = associatedFeeds
      .map((feed) => `${feed.title}\n<${feed.url}>`)
      .join('\n\n');


    await interaction.update({
      content: this.translate('responses.sub-remove-user.success', {
        feeds: responseStrings,
      }),
      components: [],
    });
  }
}
