import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { Container } from 'inversify';
import { containerTypes } from '../../events/interaction-create';
import {
  CommandLogger,
  CommandServices,
  CommandTranslate,
} from '../../types/command-container.type';
import CommandInterface from '../command.interface';

function parseUrls(text: string): string[] {
  return text.split('>').map((url) => url.trim());
}

const getPrettyErrorMessage = (
  translate: CommandTranslate, 
  error: 'EXCEEDED_FEED_LIMIT' | 'EXISTS_IN_CHANNEL' | 'INTERNAL',
) => {
  if (error === 'EXCEEDED_FEED_LIMIT') {
    return translate('commands.add.error_exceeded_feed_limit');
  }

  if (error === 'EXISTS_IN_CHANNEL') {
    return translate('commands.add.error_exists_in_channel');
  }

  return '';
};

class CommandAdd implements CommandInterface {
  commandServices: CommandServices;

  translate: CommandTranslate;

  logger: CommandLogger;

  constructor(container: Container) {
    this.commandServices = container.get<CommandServices>(containerTypes.CommandServices);
    this.translate = container.get<CommandTranslate>(containerTypes.CommandTranslate);
    this.logger = container.get<CommandLogger>(containerTypes.CommandLogger);
  }

  static data = new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a new feed')
    .addStringOption((option) => option
      .setName('url')
      .setDescription('The URL(s) of the feed. You may add multiple feed URLs be separating them '
        + 'with `>`.')
      .setRequired(true));

  async execute(interaction: CommandInteraction): Promise<void> {
    const { guildId, channelId } = interaction;

    const input = interaction.options.getString('url');
    await interaction.deferReply();

    if (!input) {
      await interaction.editReply(this.translate('commands.add.error_missing_url'));
      
      return;
    }

    const urls = parseUrls(input);

    try {
      const results = await this.commandServices
        .guildService.verifyAndAddFeeds(guildId, channelId, urls);
      const resultsText = results
        .map(({ url, error, message }) => {
          if (error) {
            return `🇽 **${url}** (${getPrettyErrorMessage(this.translate, error) || message})`;
          } else {
            return `✅ **${url}**`;
          }
        })
        .join('\n');
      
      await interaction.editReply(resultsText);
    } catch (err) {
      this.logger.error('Unable to add feed', err as Error, {
        urls,
      });
      await interaction.editReply(`${this.translate('commands.add.error_unable_to_add_feed')}` + 
        ` (${(err as Error).message})`);
    }
  }
}

export default CommandAdd;
