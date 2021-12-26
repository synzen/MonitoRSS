import { SelectMenuInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import {
  InteractionContainerSymbols,
  InteractionServices,
  InteractionTranslate,
} from '../../interaction-container.type';
import SelectMenusInterface from '../select-menus.interface';

@injectable()
export default class SubAddUser implements SelectMenusInterface {
  @inject(InteractionContainerSymbols.Services) services!: InteractionServices;

  @inject(InteractionContainerSymbols.Translate) translate!: InteractionTranslate;

  async execute(interaction: SelectMenuInteraction): Promise<void> {
    const feedIds = interaction.values;
    const userId = interaction.member.user.id;

    const foundFeeds = await Promise.all(feedIds.map(async (feedId) => {
      const feed = await this.services.feedService.findById(feedId);
      
      if (feed && feed.guild === interaction.guildId) {
        return feed;
      }

      return null;
    }));

    const existingFeeds = foundFeeds.filter(feed => feed !== null);

    if (!existingFeeds.length) {
      await interaction.reply(this.translate('responses.sub-add-user.feed_not_found'));

      return;
    }

    const currentUserSubs = await this.services.feedSubscriberService
      .findByUser(userId);

    const currentSubscribedFeedIds = new Set(currentUserSubs.map((sub) => String(sub.feed)));

    const feedsToSubscribeTo = existingFeeds
      .filter((feed) => !currentSubscribedFeedIds.has(String(feed?._id)));

    await this.services.feedSubscriberService.addForUserFeeds(
      userId,
      feedsToSubscribeTo.map((feed) => String(feed?._id)),
    );

    const responseStrings = feedsToSubscribeTo
      .map((feed) => `${feed?.title}\n<${feed?.url}>`)
      .join('\n\n');


    await interaction.update({
      content: this.translate('responses.sub-add-user.success', {
        feeds: responseStrings,
      }),
      components: [],
    });
  }
}
