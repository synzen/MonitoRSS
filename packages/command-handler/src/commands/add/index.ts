import { SlashCommandBuilder } from '@discordjs/builders';
import { Command } from '../command.interface';
import { FeedFetcher } from '@monitorss/feed-fetcher';

export default {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a new feed')
    .addStringOption((option) => option
      .setName('url')
      .setDescription('The URL of the feed.')
      .setRequired(true)),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute: async (interaction, models) => {
    const feedUrl = interaction.options.getString('url');
    await interaction.deferReply();

    if (!feedUrl) {
      await interaction.editReply('You must provide a URL.');
      return;
    }

    const feedFetcher = new FeedFetcher();
    await feedFetcher.fetchFeed(feedUrl);
    await interaction.editReply(`${feedUrl} looks good.`);
  },
} as Command;
