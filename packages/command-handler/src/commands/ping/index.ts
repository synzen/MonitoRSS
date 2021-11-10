import { CacheType, CommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { Command } from '../command.interface';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  execute: async (interaction: CommandInteraction<CacheType>) => {
    await interaction.reply('Pong!');
  },
} as Command;
