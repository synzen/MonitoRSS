import { SlashCommandBuilder } from '@discordjs/builders';
import { Command } from '../command.interface';

export default {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a new feed')
    .addStringOption((option) => option
      .setName('url')
      .setDescription('The URL of the feed.')
      .setRequired(true)),
  execute: async (interaction, services) => { 
    // TODO: Check feed limits
    const { guildId, channelId } = interaction;

    if (!guildId || !channelId) {
      console.log('No guild or channel found');
      
      return;
    }

    const feedUrl = interaction.options.getString('url');
    await interaction.deferReply();

    if (!feedUrl) {
      await interaction.editReply('You must provide a URL.');
      
      return;
    }

    try {
      await services.guildService.verifyAndAddFeeds(guildId, channelId, [feedUrl]);
      await interaction.editReply(`${feedUrl} looks good, saved.`);
    } catch (err) {
      console.log('Unable to add feed', err);
      await interaction.editReply(`Unable to add feed: ${(err as Error).message}`);
    }
  },
} as Command;
