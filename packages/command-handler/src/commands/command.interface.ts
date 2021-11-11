import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { Models } from '@monitorss/models';

export interface Command {
  data: SlashCommandBuilder
  execute: (interaction: CommandInteraction, models: Models) => Promise<void>
}
