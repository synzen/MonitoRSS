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
    const feedIds = interaction.values;

    const foundFeeds = await Promise.all(feedIds.map(async (feedId) => {
      const feed = await this.services.feedService.findById(feedId);
      
      if (feed && feed.guild === interaction.guildId) {
        return feed;
      }

      return null;
    }));

    const existingFeeds = foundFeeds.filter(Boolean);

    if (!existingFeeds.length) {
      await interaction.reply(this.translate('responses.remove-feed.not_found'));

      return;
    }

    await Promise
      .all(existingFeeds.map((feed) => this
        .services.feedService.removeOne(String(feed?._id) as string)));

    const responseStrings = existingFeeds
      .map((feed) => {
        return this.translate('responses.remove-feed.success', {
          url: feed?.url,
        });
      });


    await interaction.update({
      content: responseStrings.join('\n'),
      components: [],
    });
  }
}
