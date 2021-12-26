
import {
  CommandInteraction,
} from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { inject, injectable } from 'inversify';
import {
  InteractionContainerSymbols,
  InteractionServices,
  InteractionTranslate,
} from '../../interaction-container.type';
import { FeedFetcher } from '@monitorss/feed-fetcher';
import config from '../../../config';
import CommandInterface from '../command.interface';

@injectable()
class CommandRefresh implements CommandInterface {
  @inject(InteractionContainerSymbols.Services) services!: InteractionServices;

  @inject(InteractionContainerSymbols.Translate) translate!: InteractionTranslate;

  static data = new SlashCommandBuilder()
    .setName('refresh')
    .setDescription(
      'If any feeds have failed due to connection failures, attempt to refresh them.');

  async execute(interaction: CommandInteraction): Promise<void> {
    const allFeeds = await this.services.feedService.findByGuild(interaction.guildId);
    const allFeedUrls = Array.from(new Set(allFeeds.map(feed => feed.url)));
    
    const statuses = await this.services.failRecordService.getFailedStatuses(allFeedUrls);

    if (statuses.every((hasFailed) => !hasFailed)) {
      await interaction.reply(this.translate('commands.refresh.no_failed_feeds'));
  
      return;
    }

    const failedUrls = statuses
      .map((hasFailed, index) => ({
        hasFailed,
        url: allFeedUrls[index],
      }))
      .filter(({ hasFailed }) => hasFailed)
      .map(({ url }) => url);

    const fetcher = new FeedFetcher({
      defaultUserAgent: config.feedDefaultUserAgent,
    });

    const results = await Promise.allSettled(failedUrls.map(async (url) => {
      await fetcher.fetchURL(url);
      
      return url;
    }));

    await this.services.failRecordService.removeUrls(results
      .filter(({ status }) => status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<string>).value));

    const responseStrings = results
      .sort((resultA, resultB) => resultA.status.localeCompare(resultB.status))
      .map((result, index) => {
        const url = failedUrls[index];

        if (result.status === 'fulfilled') {
          return this.translate('commands.refresh.successful_url', {
            url,
          });
        } else {
          return this.translate('commands.refresh.failed_url', {
            url,
          });
        }
      });

    await interaction.reply({
      content: responseStrings.join('\n'),
    });
  }
}

export default CommandRefresh;
