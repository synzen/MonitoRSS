import {
  CommandInteraction,
} from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../command.interface';
import { inject, injectable } from 'inversify';
import {
  InteractionContainerSymbols,
  InteractionServices,
  InteractionTranslate,
} from '../../interaction-container.type';
import selectFeedComponents from '../../../utils/select-feed-components';
import { InteractionTask } from '../../interaction-tasks.constants';
import sendSegmentedInteractionText from '../../../utils/send-segmented-interaction-text';

@injectable()
class CommandSub implements CommandInterface {
  @inject(InteractionContainerSymbols.Services) services!: InteractionServices;

  @inject(InteractionContainerSymbols.Translate) translate!: InteractionTranslate;

  static data = new SlashCommandBuilder()
    .setName('sub')
    .setDescription('Manage when you are mentioned for the articles of any feed.')
    .addSubcommand(subcommand => subcommand
      .setName('add')
      .setDescription(
        'Get directly mentioned when a new post is made for a feed that has '
          + 'direct subscribers enabled.',
      ))
    .addSubcommand(subcommand => subcommand
      .setName('remove')
      .setDescription(
        'Remove yourself from being directly mentioned when a new post is made for a feed.',
      ))
    .addSubcommand(subcommand => subcommand
      .setName('list')
      .setDescription('List all the feeds you are currently being mentioned in.'));

  subCommandHandlers: Map<string, (interaction: CommandInteraction) => Promise<void>> = new Map([
    ['add', this.handleAdd.bind(this)],
    ['remove', this.handleRemove.bind(this)],
    ['list', this.handleList.bind(this)],
  ]);

  async execute(interaction: CommandInteraction): Promise<void> {
    const subCommand = interaction.options.getSubcommand(true);
    const handler = this.subCommandHandlers.get(subCommand);

    if (!handler) {
      throw new Error(`No handler for "sub" subcommand ${subCommand}`);
    }

    await handler(interaction);
  }

  private async handleAdd(interaction: CommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    
    const guildFeeds = await this.services.feedService
      .findByGuild(guildId);

    const feedIdsWithDirectAddDisabled = guildFeeds
      .filter(feed => !feed.directSubscribers)
      .map(feed => String(feed._id));

    const subscribers = await this.services.feedSubscriberService
      .findByUser(interaction.member.user.id);

    const feedsAlreadySubscribedTo = subscribers.map(subscriber => String(subscriber.feed));

    const excludeFeedIds = feedsAlreadySubscribedTo.concat(feedIdsWithDirectAddDisabled);

    if (excludeFeedIds.length === guildFeeds.length) {
      await interaction.reply({
        content: this.translate('commands.sub.add_no_feeds_available'),
      });
      
      return;
    }
    
    await interaction.reply({
      content: this.translate('commands.sub.add_select_feeds'),
      components: await selectFeedComponents(
        this.services,
        guildId,
        channelId,
        InteractionTask.ADD_USER_FEED_SUBSCRIBER,
        0,
        excludeFeedIds,
      ),
    });
  }

  private async handleRemove(interaction: CommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    
    const feeds = await this.services.feedService.findByGuild(guildId);

    const subscribers = await this.services.feedSubscriberService
      .findByUser(interaction.member.user.id);

    const subscribedFeedIds = new Set<string>(
      subscribers.map(subscriber => String(subscriber.feed)));

    const nonSubscribedFeedIds = feeds
      .map(feed => String(feed._id))
      .filter(feedId => !subscribedFeedIds.has(feedId));

    await interaction.reply({
      content: this.translate('commands.sub.remove_select_feeds'),
      components: await selectFeedComponents(
        this.services, 
        guildId,
        channelId,
        InteractionTask.REMOVE_USER_FEED_SUBSCRIBER,
        0,
        nonSubscribedFeedIds,
      ),
    });
  }

  private async handleList(interaction: CommandInteraction): Promise<void> {
    const subscribers = await this.services.feedSubscriberService
      .findByUser(interaction.member.user.id);

    if (subscribers.length === 0) {
      await interaction.reply({
        content: this.translate('commands.sub.list_no_feeds'),
      });
      
      return;
    }

    const feeds = await this.services.feedService.findByIds(
      subscribers.map(subscriber => String(subscriber.feed)));

    const feedsText = feeds.map(feed => `${feed.title}\n<${feed.url}>`).join('\n\n');

    const replyText = this.translate('commands.sub.list', {
      feeds: feedsText,
    });

    await sendSegmentedInteractionText(replyText, interaction, {
      deferred: false,
    });
  }
}

export default CommandSub;
