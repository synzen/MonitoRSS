import {
  CommandInteraction,
  TextChannel,
} from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../command.interface';
import { inject, injectable } from 'inversify';
import {
  commandContainerSymbols,
  CommandServices,
  CommandTranslate,
} from '../../types/command-container.type';
import { ChannelType } from 'discord-api-types';
import selectFeedComponents from '../../utils/select-feed-components';
import {
  InteractionTasks,
} from '../../types/interaction-custom-id.type';

@injectable()
class CommandRemove implements CommandInterface {
  @inject(commandContainerSymbols.CommandServices) commandServices!: CommandServices;

  @inject(commandContainerSymbols.CommandTranslate) translate!: CommandTranslate;

  static data = new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a feed')
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('The channel the feed belongs to')
      .setRequired(true)
      .addChannelType(ChannelType.GuildText),
    );

  async execute(interaction: CommandInteraction): Promise<void> {
    const guildId = interaction.guild?.id;
    const channelId = interaction.channel?.id;

    if (!guildId || !channelId) {
      return;
    }

    const feedCount = await this.commandServices.feedService.count({
      guild: interaction.guild?.id,
      channel: interaction.channel?.id,
    });

    if (feedCount === 0) {
      return interaction.reply(this.translate('commands.remove.no_feeds_to_remove'));
    }

    const channel = interaction.options.getChannel('channel') as TextChannel;
  
    await interaction.reply({
      content: this.translate('commands.remove.select_feed_to_remove'),
      components: await selectFeedComponents(
        this.commandServices, guildId, channel.id, InteractionTasks.REMOVE_FEED),
    });
  }
}

export default CommandRemove;
