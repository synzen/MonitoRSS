import {
  CommandInteraction,
  MessageActionRow,
  MessageButton,
  MessageSelectMenu,
  TextChannel,
} from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../command.interface';
import { inject, injectable } from 'inversify';
import { commandContainerSymbols, CommandServices } from '../../types/command-container.type';
import { ChannelType } from 'discord-api-types';

@injectable()
class CommandRemove implements CommandInterface {
  @inject(commandContainerSymbols.CommandServices) commandServices!: CommandServices;

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

    if (!guildId) {
      return;
    }

    const feeds = await this.commandServices.feedService.findByGuild(interaction.guild?.id);

    if (feeds.length === 0) {
      return interaction.reply('There are no feeds to remove.');
    }

    const channel = interaction.options.getChannel('channel') as TextChannel;

    // TODO: Handle more than 100 feeds
    const row = new MessageActionRow()
      .addComponents(
        new MessageSelectMenu()
          .setCustomId('remove-feed')
          .setPlaceholder('Please select a feed')
          .addOptions(feeds.map(feed => ({
            label: feed.title,
            value: feed._id.toHexString(),
            description: `${feed.url} in channel ${channel.name}`,
          }))),
      );

    const buttonRow = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId('previous-feeds')
          .setLabel('Back')
          .setStyle('SECONDARY'),
        new MessageButton()
          .setCustomId('label')
          .setLabel('Page 1/2')
          .setStyle('SECONDARY')
          .setDisabled(true),
        new MessageButton()
          .setCustomId('next-feeds')
          .setLabel('Next')
          .setStyle('SECONDARY'),
      );
  
    await interaction.reply({
      content: 'Select a feed below to remove',
      components: [row, buttonRow],
    });
  }
}

export default CommandRemove;
