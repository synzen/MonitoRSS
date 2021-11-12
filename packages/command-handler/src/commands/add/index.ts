import { SlashCommandBuilder } from '@discordjs/builders';
import { Command } from '../command.interface';
import feedIsUniqueInChannel from './feed-is-unique-in-channel';
import getFeedToSave from './get-feed-to-save';

export default {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a new feed')
    .addStringOption((option) => option
      .setName('url')
      .setDescription('The URL of the feed.')
      .setRequired(true)),
  execute: async (interaction, models) => {
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

    if (!feedIsUniqueInChannel(channelId, feedUrl, models.Feed)) {
      await interaction.editReply('That feed is already in this channel.');
      
      return;
    }

    try {
      const toSave = await getFeedToSave(guildId, channelId, feedUrl);
      await models.Feed.insert(toSave);
      await interaction.editReply(`${feedUrl} looks good, saved.`);
    } catch (err) {
      console.log('Unable to add feed', err);
      await interaction.editReply(`Unable to add feed: ${(err as Error).message}`);
    }
  },
} as Command;
