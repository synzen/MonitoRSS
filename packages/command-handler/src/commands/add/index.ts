import { SlashCommandBuilder } from '@discordjs/builders';
import { Command } from '../command.interface';

function parseUrls(text: string): string[] {
  return text.split('>').map((url) => url.trim());
}

const getPrettyErrorMessage = (error: 'EXCEEDED_FEED_LIMIT' | 'EXISTS_IN_CHANNEL' | 'INTERNAL') => {
  if (error === 'EXCEEDED_FEED_LIMIT') {
    return 'You will exceed the maximum number of feeds for this server.';
  }

  if (error === 'EXISTS_IN_CHANNEL') {
    return 'This feed is already in this channel.';
  }

  if (error === 'INTERNAL') {
    return 'An internal error occurred.';
  }

  return 'An unknown error occurred.';
};

export default {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a new feed')
    .addStringOption((option) => option
      .setName('url')
      .setDescription('The URL of the feed.')
      .setRequired(true)),
  execute: async (interaction, services) => { 
    const { guildId, channelId } = interaction;

    if (!guildId || !channelId) {
      console.log('No guild or channel found');
      
      return;
    }

    const input = interaction.options.getString('url');
    await interaction.deferReply();

    if (!input) {
      await interaction.editReply('You must provide a URL.');
      
      return;
    }

    const urls = parseUrls(input);

    try {
      const results = await services.guildService.verifyAndAddFeeds(guildId, channelId, urls);
      const resultsText = results
        .map(({ url, error }) => {
          if (error) {
            return `🇽 **${url}** (${getPrettyErrorMessage(error)})`;
          } else {
            return `✅ **${url}**`;
          }
        })
        .join('\n');
      
      await interaction.editReply(resultsText);
    } catch (err) {
      console.log('Unable to add feed', err);
      await interaction.editReply(`Unable to add feed: ${(err as Error).message}`);
    }
  },
} as Command;
