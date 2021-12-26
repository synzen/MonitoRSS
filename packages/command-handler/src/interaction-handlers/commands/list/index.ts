import { CommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../command.interface';
import { inject, injectable } from 'inversify';
import { 
  InteractionContainerSymbols,
  InteractionServices,
  InteractionTranslate, 
} from '../../interaction-container.type';

@injectable()
class CommandList implements CommandInterface {
  @inject(InteractionContainerSymbols.Services) services!: InteractionServices;

  @inject(InteractionContainerSymbols.Translate) translate!: InteractionTranslate;

  static data = new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all the feeds in this server')
    .addChannelOption(option => option
      .setRequired(false)
      .setName('channel')
      .setDescription('The channel that the feeds belong to'));

  async execute(interaction: CommandInteraction): Promise<void> {
    const channel = interaction.options.getChannel('channel');

    const feeds = await this.services.feedService.find({
      guild: interaction.guildId,
      ...(channel ? { channel: channel.id } : {}),
    });

    if (!feeds.length) {
      await interaction.reply(this.translate('commands.list.no_feeds'));
      
      return;
    }

    await interaction.deferReply();

    const failedStatuses = await this.services.failRecordService
      .getFailedStatuses(feeds.map((feed) => feed.url));

    const feedSchedules = await this.services.feedSchedulingService.determineSchedules(
      feeds.map((feed) => ({
        id: String(feed._id),
        url: feed.url,
        guildId: feed.guild,
      })),
    );

    const feedTextList = feeds
      .map((feed, index) => {
        const failStatus = failedStatuses[index];

        const statusText = failStatus ? '❌' : '✅';

        return `${this.translate('commands.list.entry_url', {
          url: feed.url,
        })}\n${this.translate('commands.list.entry_channel', {
          channel: feed.channel,
        })}\n${this.translate('commands.list.entry_status', {
          status: statusText,
        })}\n${this.translate('commands.list.entry_refresh_rate', {
          refreshRate: feedSchedules[index]?.refreshRateMinutes || 'N/A',
        })}`;
      });

    const someHasFailed = failedStatuses.some(hasFailed => hasFailed);

    await interaction.editReply({
      content: `${someHasFailed
        ? this.translate('commands.list.failed_warning')
        : ''}\n\n${feedTextList.join('\n\n')}`,
    });
  }
}

export default CommandList;
