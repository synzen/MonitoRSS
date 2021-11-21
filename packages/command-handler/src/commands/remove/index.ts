import { CommandInteraction, MessageActionRow, MessageSelectMenu } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../command.interface';
import { inject, injectable } from 'inversify';
import { commandContainerSymbols, CommandServices } from '../../types/command-container.type';

@injectable()
class CommandRemove implements CommandInterface {
  @inject(commandContainerSymbols.CommandServices) commandServices!: CommandServices;

  static data = new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a feed');

  async execute(interaction: CommandInteraction): Promise<void> {
    const guildId = interaction.guild?.id;

    if (!guildId) {
      return;
    }

    const feeds = await this.commandServices.feedService.findByGuild(interaction.guild?.id);

    if (feeds.length === 0) {
      return interaction.reply('There are no feeds to remove.');
    }

    // TODO: Handle more than 100 feeds
    const row = new MessageActionRow()
      .addComponents(
        new MessageSelectMenu()
          .setCustomId('remove-feed')
          .setPlaceholder('Please select a feed')
          .addOptions(feeds.map(feed => ({
            label: feed.title,
            value: feed._id.toHexString(),
            description: `${feed.url} in channel ${interaction.channelId}`,
          }))),
      );

    await interaction.reply({
      content: 'Select a feed below to remove',
      components: [row],
    });
  }
}

export default CommandRemove;
