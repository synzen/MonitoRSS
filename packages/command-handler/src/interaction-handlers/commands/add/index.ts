import { SlashCommandBuilder } from '@discordjs/builders';
import { ChannelType } from 'discord-api-types';
import { CommandInteraction, TextChannel } from 'discord.js';
import { inject, injectable } from 'inversify';
import {
  InteractionContainerSymbols,
  InteractionLogger,
  InteractionServices,
  InteractionTranslate,
} from '../../interaction-container.type';
import CommandInterface from '../command.interface';

function parseUrls(text: string): string[] {
  return text.split('>').map((url) => url.trim());
}

const getPrettyErrorMessage = (
  translate: InteractionTranslate, 
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

@injectable()
class CommandAdd implements CommandInterface {
  @inject(InteractionContainerSymbols.Services) services!: InteractionServices;

  @inject(InteractionContainerSymbols.Logger) logger!: InteractionLogger;

  @inject(InteractionContainerSymbols.Translate) translate!: InteractionTranslate;

  static data = new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a new feed')
    .addStringOption((option) => option
      .setName('url')
      .setDescription('The URL(s) of the feed. You may add multiple feed URLs be separating them '
        + 'with `>`.')
      .setRequired(true))
    .addChannelOption((option) => option
      .setName('channel')
      .setDescription('The channel that the feed(s) will be added to')
      .setRequired(true)
      .addChannelType(ChannelType.GuildText),
    );

  async execute(interaction: CommandInteraction): Promise<void> {
    const { guildId } = interaction;

    const input = interaction.options.getString('url');
    await interaction.deferReply();

    if (!input) {
      await interaction.editReply(this.translate('commands.add.error_missing_url'));
      
      return;
    }

    const urls = parseUrls(input);

    try {
      const channel = interaction.options.getChannel('channel') as TextChannel;

      if (!channel) {
        await interaction.editReply(this.translate('commands.add.error_missing_channel'));

        return;
      }

      const results = await this.services
        .guildService.verifyAndAddFeeds(guildId, channel.id, urls);
      const resultsText = results
        .map(({ url, error, message }) => {
          if (error) {
            return `❌ **${url}** (${getPrettyErrorMessage(this.translate, error) || message})`;
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
